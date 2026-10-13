import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  ensureNotificationSchema,
  notificationStatement,
} from '../packages/notifications/src/persistence';
import { defaultPreferences } from '../packages/notifications/src/contract';
import { authRepository } from '../workers/api/src/repositories/auth.repository';
import { projectRepository } from '../workers/api/src/repositories/project.repository';
import { commentRepository } from '../workers/api/src/repositories/comment.repository';
import { communityRepository } from '../workers/api/src/repositories/community.repository';
import { registerPush } from '../workers/api/src/notifications/channels';
import { processNotificationsScheduled } from '../workers/api/src/notifications/delivery';
import { readNotifications, listNotifications } from '../workers/api/src/notifications/repository';
import { base64url } from '../workers/api/src/notifications/web-push';
import type { ApiWorkerEnv } from '../workers/api/src/types/env';
const runtime = createRequire(createRequire(import.meta.url).resolve('wrangler/package.json'));
const { Miniflare } = runtime('miniflare');
const mf = new Miniflare({
  modules: true,
  script: 'export default {fetch(){return new Response("ok")}}',
  d1Databases: { DB: 'notification-scheduler' },
});
const originalFetch = globalThis.fetch;
try {
  const db = (await mf.getD1Database('DB')) as D1Database;
  await authRepository.createUser(db, { id: 'sender', email: 'scheduler@example.invalid' });
  await projectRepository.createProjectRecord(db, {
    id: 'subject',
    name: 'Private content is never in external payload',
    ownerId: 'sender',
    status: 'Live',
    isPublic: true,
    framework: 'Unknown',
    sourceType: 'html',
    repoUrl: '',
    url: 'https://example.invalid',
    lastDeployed: new Date().toISOString(),
  });
  await Promise.all([
    ensureNotificationSchema(db),
    commentRepository.ensureSchema(db),
    communityRepository.ensureSchema(db),
  ]);
  const signer = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ]);
  const env = {
    PROJECTS_DB: db,
    NOTIFICATION_VAPID_JWK: JSON.stringify(await crypto.subtle.exportKey('jwk', signer.privateKey)),
    NOTIFICATION_SEND_ENABLED: '1',
  } as ApiWorkerEnv;
  const receiver = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ]);
  const keys = {
    p256dh: base64url(new Uint8Array(await crypto.subtle.exportKey('raw', receiver.publicKey))),
    auth: base64url(crypto.getRandomValues(new Uint8Array(16))),
  };
  const calls = new Map<string, number>();
  const responses = new Map<string, number | 'timeout'>();
  globalThis.fetch = (async (input, init) => {
    const endpoint = String(input);
    if (!endpoint.startsWith('https://fcm.googleapis.com/')) return originalFetch(input, init);
    const recipient = endpoint.split('/').at(-1)!;
    calls.set(recipient, (calls.get(recipient) ?? 0) + 1);
    assert.ok(
      init?.body instanceof Uint8Array,
      'real encrypted RFC payload reaches provider boundary'
    );
    if (responses.get(recipient) === 'timeout')
      throw Error('simulated accepted-or-lost connection');
    return new Response(null, {
      status: responses.get(recipient) ?? 201,
      headers: { 'Retry-After': '120' },
    });
  }) as typeof fetch;
  const setup = async (id: string, patch: Record<string, unknown> = {}) => {
    const prefs = {
      ...defaultPreferences(),
      timezone: 'UTC',
      quietStart: 0,
      quietEnd: 1,
      external: { direct: true, feedback: false, deployment: false, digest: false },
      ...patch,
    };
    await db
      .prepare('INSERT INTO notification_preferences(user_id,settings,consented_at) VALUES(?,?,?)')
      .bind(id, JSON.stringify(prefs), Date.now())
      .run();
    await registerPush(db, id, { endpoint: 'https://fcm.googleapis.com/fcm/send/' + id, keys });
    await commentRepository.insertComment(db, {
      id: 'comment:' + id,
      projectId: 'subject',
      userId: 'sender',
      content: 'private-body-' + id,
      replyToCommentId: null,
      notifications: [
        notificationStatement(db, {
          key: id,
          actorId: 'sender',
          recipientId: id,
          kind: 'reply',
          priority: 'important',
          subjectId: 'subject',
          commentId: 'comment:' + id,
          groupKey: id,
          at: Date.now() - 11 * 60000,
        }),
      ],
    });
  };
  const delivery = async (id: string) =>
    db
      .prepare(
        'SELECT state,attempts,not_before,payload FROM notification_deliveries WHERE recipient_id=? ORDER BY rowid DESC LIMIT 1'
      )
      .bind(id)
      .first<{ state: string; attempts: number; not_before: number; payload: string }>();
  const tick = () => processNotificationsScheduled(env);
  await setup('success');
  await tick();
  assert.equal((await delivery('success'))?.state, 'accepted');
  assert.equal(calls.get('success'), 1);
  assert.equal(
    (await listNotifications(db, 'success')).important,
    1,
    'provider acceptance is not read'
  );
  assert.ok(!(await delivery('success'))!.payload.includes('private-body'));
  await tick();
  assert.equal(calls.get('success'), 1);
  await setup('quiet', { quietStart: 0, quietEnd: 1439 });
  await tick();
  assert.equal(calls.get('quiet'), undefined);
  assert.equal((await delivery('quiet'))?.state, 'pending');
  const unread = await listNotifications(db, 'quiet');
  await readNotifications(db, 'quiet', 'quiet', unread.snapshotSeq);
  await db
    .prepare("UPDATE notification_deliveries SET not_before=0 WHERE recipient_id='quiet'")
    .run();
  await tick();
  assert.equal(
    (await delivery('quiet'))?.state,
    'cancelled',
    'read in another window cancels delayed delivery'
  );
  await setup('unknown');
  responses.set('unknown', 'timeout');
  await tick();
  assert.equal((await delivery('unknown'))?.state, 'unknown');
  await tick();
  assert.equal(calls.get('unknown'), 1, 'unknown acceptance is never auto resent');
  await setup('expired');
  responses.set('expired', 410);
  await tick();
  assert.equal((await delivery('expired'))?.state, 'failed');
  assert.equal(
    (
      await db
        .prepare(
          "SELECT COUNT(*) AS n FROM notification_push_subscriptions WHERE user_id='expired'"
        )
        .first<{ n: number }>()
    )?.n,
    0
  );
  await setup('retry');
  responses.set('retry', 429);
  await tick();
  assert.equal((await delivery('retry'))?.state, 'retryable');
  assert.ok((await delivery('retry'))!.not_before > Date.now());
  responses.set('retry', 201);
  await db
    .prepare("UPDATE notification_deliveries SET not_before=0 WHERE recipient_id='retry'")
    .run();
  await tick();
  assert.equal((await delivery('retry'))?.state, 'accepted');
  assert.equal(calls.get('retry'), 2);
  await setup('foreground');
  await db
    .prepare("INSERT INTO notification_presence VALUES('foreground',?)")
    .bind(Date.now())
    .run();
  await tick();
  assert.equal(
    calls.get('foreground'),
    undefined,
    'visible-window heartbeat defers external delivery'
  );
  await setup('badge-off', {
    badges: { comments: false, reactions: true, follows: true, system: true },
  });
  await tick();
  assert.equal(
    calls.get('badge-off'),
    1,
    'badge display is independent of explicit external consent'
  );
  await setup('paused', { pausedUntil: Date.now() + 86400000 });
  await tick();
  assert.equal(calls.get('paused'), undefined);
  await setup('muted');
  await db
    .prepare("INSERT INTO notification_subject_mutes(user_id,subject_id) VALUES('muted','subject')")
    .run();
  await tick();
  assert.equal(calls.get('muted'), undefined);
  await setup('revoked');
  await db
    .prepare("UPDATE notifications SET revoked_at=? WHERE recipient_id='revoked'")
    .bind(Date.now())
    .run();
  await tick();
  assert.equal(calls.get('revoked'), undefined);
  await setup('stale');
  await db
    .prepare("UPDATE notifications SET created_at=? WHERE recipient_id='stale'")
    .bind(Date.now() - 91 * 86400000)
    .run();
  await tick();
  assert.equal(
    await db.prepare("SELECT seq FROM notifications WHERE recipient_id='stale'").first(),
    null
  );
  assert.equal(calls.get('stale'), undefined);
  await setup('ignored');
  await db
    .prepare("UPDATE notification_preferences SET consented_at=? WHERE user_id='ignored'")
    .bind(Date.now() - 8 * 86400000)
    .run();
  for (let i = 0; i < 3; i++)
    await db
      .prepare(
        "INSERT INTO notification_deliveries(id,recipient_id,channel,scope,payload,state,not_before,expires_at,first_attempt_at) VALUES(?,'ignored','push',?,?,'accepted',0,?,?)"
      )
      .bind(
        'ignored-old-' + i,
        'ignored-old-' + i,
        JSON.stringify({ category: 'direct', groups: [] }),
        Date.now() + 86400000,
        Date.now() - 2 * 86400000
      )
      .run();
  await tick();
  assert.equal(
    calls.get('ignored'),
    undefined,
    'continuous ignoring after seven days reduces instant reminders'
  );
  const resumed=Date.now();await db.prepare("UPDATE notification_preferences SET resumed_at=? WHERE user_id='ignored'").bind(resumed).run();await tick();assert.equal(calls.get('ignored'),undefined,'resume does not flush ignored backlog');
  await commentRepository.insertComment(db,{id:'fresh-after-resume',projectId:'subject',userId:'sender',content:'New event',replyToCommentId:null,notifications:[notificationStatement(db,{key:'fresh-after-resume',actorId:'sender',recipientId:'ignored',kind:'reply',subjectId:'subject',commentId:'fresh-after-resume',groupKey:'fresh-after-resume',priority:'important',at:resumed+1000})]});
  await processNotificationsScheduled(env,resumed+12*60000);assert.equal(calls.get('ignored'),1,'new events after resume remain eligible without resetting budgets');
  await setup('private');
  await projectRepository.updateProjectRecord(db, 'subject', { isPublic: false });
  await tick();
  assert.equal(calls.get('private'), undefined, 'current private permission is rechecked');
  console.log(
    'PASS: assembled scheduler through actual D1 and real encryption; mocked provider acceptance, unknown/no retry, 410 cleanup, 429 safe retry, quiet/read cancellation, pause, mute, tombstone, permission and 90-day retention'
  );
} finally {
  globalThis.fetch = originalFetch;
  await mf.dispose();
}
