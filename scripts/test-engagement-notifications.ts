import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { authRepository } from '../workers/api/src/repositories/auth.repository';
import { projectRepository } from '../workers/api/src/repositories/project.repository';
import { communityRepository } from '../workers/api/src/repositories/community.repository';
import { commentRepository } from '../workers/api/src/repositories/comment.repository';
import { deploymentRepository } from '../workers/api/src/repositories/deployment.repository';
import { manageFeedback } from '../workers/admin/src/feedback';
import type { AdminEnv } from '../workers/admin/src/auth';
import type { NotificationPage } from '../packages/notifications/src/contract';
import {
  ensureNotificationSchema,
  notificationStatement,
} from '../packages/notifications/src/persistence';
const require = createRequire(import.meta.url);
const runtime = createRequire(require.resolve('wrangler/package.json'));
const { Miniflare } = runtime('miniflare');
const { build } = runtime('esbuild');
const bundle = await build({
  entryPoints: ['workers/api/src/index.ts'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'browser',
  external: ['cloudflare:workers'],
});
const mf = new Miniflare({
  modules: [{ type: 'ESModule', path: 'worker.mjs', contents: bundle.outputFiles[0].text }],
  compatibilityDate: '2026-09-18',
  d1Databases: { PROJECTS_DB: 'notifications-test' },
  bindings: { AUTH_REDIRECT_BASE: 'https://gemigo.io' },
});
try {
  const db = (await mf.getD1Database('PROJECTS_DB')) as D1Database;
  const author = crypto.randomUUID(),
    reader = crypto.randomUUID();
  await authRepository.createUser(db, {
    id: author,
    email: 'author@example.invalid',
    handle: 'author',
    displayName: '作者',
  });
  await authRepository.createUser(db, {
    id: reader,
    email: 'reader@example.invalid',
    handle: 'reader',
    displayName: '读者',
  });
  const authorSession = await authRepository.createSession(db, author),
    readerSession = await authRepository.createSession(db, reader);
  const projectId = crypto.randomUUID();
  await projectRepository.createProjectRecord(db, {
    id: projectId,
    name: '色彩实验室',
    ownerId: author,
    isPublic: true,
    status: 'Live',
    framework: 'Unknown',
    sourceType: 'html',
    repoUrl: '',
    lastDeployed: new Date().toISOString(),
    url: 'https://fixture.example.invalid',
  });
  const call = async (path: string, session: string, method = 'GET', body?: unknown) => {
    const response = await mf.dispatchFetch('https://gemigo.io/api/v1' + path, {
      method,
      headers: { cookie: 'session_id=' + session, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    return { response, data };
  };
  const inbox = async (session: string): Promise<NotificationPage> => {
    const result = await call('/notifications', session);
    assert.equal(result.response.status, 200, JSON.stringify(result.data));
    return result.data as NotificationPage;
  };
  assert.equal(
    (await inbox(authorSession.id)).items.length,
    0,
    'fresh inbox initializes all source schemas'
  );
  const submissionId = crypto.randomUUID();
  const comment = await call('/projects/' + projectId + '/comments', readerSession.id, 'POST', {
    content: '能不能保存颜色？',
    submissionId,
  });
  assert.equal(comment.response.status, 200, JSON.stringify(comment.data));
  const retry = await call('/projects/' + projectId + '/comments', readerSession.id, 'POST', {
    content: '能不能保存颜色？',
    submissionId,
  });
  assert.equal(retry.response.status, 200);
  assert.equal(retry.data.comment.id, submissionId);
  let page = await inbox(authorSession.id);
  assert.equal(page.important, 1);
  assert.equal(page.items[0].commentId, submissionId);
  assert.equal(page.items[0].needsReply, true);
  assert.equal(
    (await inbox(readerSession.id)).items.length,
    0,
    'sender receives no own notification'
  );
  const context = await call(
    '/projects/' + projectId + '/comments/context?commentId=' + submissionId,
    authorSession.id
  );
  assert.equal(context.response.status, 200);
  assert.equal(context.data.target.content, '能不能保存颜色？');
  await call('/notifications/read', authorSession.id, 'POST', {
    groupKey: page.items[0].groupKey,
    throughSeq: page.items[0].throughSeq,
  });
  assert.equal((await inbox(authorSession.id)).important, 0);
  const replyId = crypto.randomUUID();
  const reply = await call('/projects/' + projectId + '/comments', authorSession.id, 'POST', {
    content: '可以，我来加上。',
    submissionId: replyId,
    replyToCommentId: submissionId,
  });
  assert.equal(reply.response.status, 200, JSON.stringify(reply.data));
  page = await inbox(readerSession.id);
  assert.equal(page.important, 1);
  assert.equal(page.items[0].kind, 'reply');
  assert.equal((await inbox(authorSession.id)).items[0].needsReply, false);
  // A captured all-read watermark must not acknowledge a concurrent new event.
  const snapshot = page.snapshotSeq;
  await ensureNotificationSchema(db);
  await db.batch([
    notificationStatement(db, {
      key: 'manual-next',
      actorId: author,
      recipientId: reader,
      kind: 'reply',
      subjectId: projectId,
      commentId: replyId,
      groupKey: 'replies:' + submissionId,
      priority: 'important',
    }),
  ]);
  assert.equal(
    (
      await call('/notifications/read', readerSession.id, 'POST', {
        all: true,
        throughSeq: snapshot,
      })
    ).response.status,
    200
  );
  assert.equal((await inbox(readerSession.id)).important, 1);
  // Subject mute is reversible without replaying the events received while muted.
  await call('/notification-mutes', readerSession.id, 'POST', { subjectId: projectId });
  assert.equal((await inbox(readerSession.id)).important, 0);
  assert.equal((await inbox(readerSession.id)).items[0].muted, true);
  await db.batch([
    notificationStatement(db, {
      key: 'while-muted',
      actorId: author,
      recipientId: reader,
      kind: 'reply',
      subjectId: projectId,
      commentId: replyId,
      groupKey: 'replies:' + submissionId,
      priority: 'important',
    }),
  ]);
  assert.equal(
    (await call('/notification-mutes', readerSession.id, 'DELETE', { subjectId: projectId }))
      .response.status,
    200
  );
  assert.equal(
    (await inbox(readerSession.id)).important,
    0,
    'unmuting does not revive old attention'
  );
  await db.batch([
    notificationStatement(db, {
      key: 'after-unmute',
      actorId: author,
      recipientId: reader,
      kind: 'reply',
      subjectId: projectId,
      commentId: replyId,
      groupKey: 'replies:' + submissionId,
      priority: 'important',
    }),
  ]);
  assert.equal((await inbox(readerSession.id)).important, 1);
  const wrongViewer = await mf.dispatchFetch('https://gemigo.io/api/v1/notifications', {
    headers: { cookie: 'session_id=' + readerSession.id, 'X-Gemigo-Viewer': author },
  });
  assert.equal(
    wrongViewer.status,
    409,
    'account identity mismatch rejects before returning content'
  );
  await call('/projects/' + projectId + '/like', readerSession.id, 'POST');
  await call('/projects/' + projectId + '/like', readerSession.id, 'POST');
  page = await inbox(authorSession.id);
  let likes = page.items.filter((item) => item.kind === 'like');
  assert.equal(likes.length, 1);
  assert.equal(likes[0].count, 1);
  await call('/projects/' + projectId + '/like', readerSession.id, 'DELETE');
  await call('/projects/' + projectId + '/like', readerSession.id, 'POST');
  likes = (await inbox(authorSession.id)).items.filter((item) => item.kind === 'like');
  assert.equal(likes[0].count, 1);
  assert.equal(likes[0].unread, false, 're-add does not restart notification eligibility');
  for (let i = 0; i < 20; i++) {
    const actor = crypto.randomUUID();
    await authRepository.createUser(db, { id: actor, email: 'actor-' + i + '@example.invalid' });
    const session = await authRepository.createSession(db, actor);
    assert.equal(
      (await call('/projects/' + projectId + '/like', session.id, 'POST')).response.status,
      200
    );
  }
  const group = (await inbox(authorSession.id)).items.filter((item) => item.kind === 'like');
  assert.equal(group.length, 1);
  assert.equal(
    group[0].count,
    21,
    'twenty actors contribute to one group plus original active actor'
  );
  await call('/projects/' + projectId + '/favorite', readerSession.id, 'POST');
  const favorite = (await inbox(authorSession.id)).items.find((item) => item.kind === 'favorite');
  assert.equal(favorite?.actorName, null);
  const library = await call('/me/favorites', readerSession.id);
  assert.equal(library.response.status, 200);
  assert.equal(library.data.items[0].id, projectId, 'favorites of other authors are recoverable');
  await call('/users/author/follow', readerSession.id, 'POST');
  assert.equal((await call('/me/following', readerSession.id)).data.items[0].id, author);
  await projectRepository.updateProjectRecord(db, projectId, { isPublic: false });
  assert.equal(
    (
      await call(
        '/projects/' + projectId + '/comments/context?commentId=' + submissionId,
        readerSession.id
      )
    ).response.status,
    404
  );
  assert.equal(
    (await inbox(readerSession.id)).items.filter((item) => item.subjectId === projectId).length,
    0,
    'private source drops from inbox and counts'
  );
  assert.equal((await call('/me/favorites', readerSession.id)).data.items.length, 0);
  await projectRepository.updateProjectRecord(db, projectId, { isPublic: true });
  assert.equal(
    (await call('/me/following/publications', readerSession.id)).data.items.length,
    1,
    'first public publication after follow becomes visible'
  );
  await projectRepository.updateProjectRecord(db, projectId, { isPublic: false });
  await projectRepository.updateProjectRecord(db, projectId, { isPublic: true });
  assert.equal(
    (
      await db
        .prepare('SELECT COUNT(*) AS n FROM first_publications WHERE project_id=?')
        .bind(projectId)
        .first<{ n: number }>()
    )?.n,
    1
  );
  for (let i = 0; i < 40; i++)
    await commentRepository.insertComment(db, {
      id: 'older-target-page-' + i,
      projectId,
      userId: reader,
      content: 'Newer content ' + i,
      replyToCommentId: null,
    });
  const laterTarget = await call(
    '/projects/' + projectId + '/comments/context?commentId=' + submissionId,
    authorSession.id
  );
  assert.equal(laterTarget.data.target.id, submissionId);
  assert.ok(
    !laterTarget.data.items.some((item: { id: string }) => item.id === submissionId),
    'old target is fetched independently of its page'
  );
  await db.prepare('UPDATE projects SET owner_id=? WHERE id=?').bind(reader, projectId).run();
  assert.ok(
    !(await inbox(authorSession.id)).items.some((item) =>
      ['comment', 'like', 'favorite', 'deployment_failure'].includes(item.kind)
    ),
    'previous owner notifications lose eligibility'
  );
  await db.prepare('UPDATE projects SET owner_id=? WHERE id=?').bind(author, projectId).run();
  // Real independent-console producer, stable reply ID and optimistic status update.
  await communityRepository.createPost(db, {
    id: 'feedback-test',
    userId: reader,
    title: '保存问题',
    content: '请支持保存',
    category: 'idea',
  });
  await db
    .prepare(
      'CREATE TABLE IF NOT EXISTS admin_audit(id TEXT PRIMARY KEY,actor TEXT,action TEXT,target TEXT,detail TEXT,at INTEGER)'
    )
    .run();
  const adminEnv = { ANALYTICS_DB: db, ADMIN_USERNAME: 'fixture-admin' } as AdminEnv;
  const teamReply = crypto.randomUUID();
  await manageFeedback(adminEnv, {
    id: 'feedback-test',
    action: 'reply',
    content: '已经安排',
    replyId: teamReply,
  });
  await manageFeedback(adminEnv, {
    id: 'feedback-test',
    action: 'reply',
    content: '已经安排',
    replyId: teamReply,
  });
  await manageFeedback(adminEnv, {
    id: 'feedback-test',
    action: 'status',
    expected: 'open',
    status: 'planned',
  });
  const feedback = (await inbox(readerSession.id)).items.find(
    (item) => item.groupKey === 'feedback:feedback-test'
  );
  assert.equal(feedback?.count, 2);
  assert.equal(feedback?.kind, 'feedback_status');
  assert.equal((await call('/me/feedback/feedback-test', authorSession.id)).response.status, 404);
  assert.equal(
    (await call('/me/feedback/feedback-test', readerSession.id)).data.comments.length,
    1
  );
  // Failure inside the notification statement rolls back the business comment.
  await db
    .prepare("UPDATE project_comments SET created_at='2000-01-01T00:00:00Z' WHERE user_id=?")
    .bind(reader)
    .run();
  await db
    .prepare(
      "CREATE TRIGGER reject_notification BEFORE INSERT ON notifications WHEN NEW.kind='comment' BEGIN SELECT RAISE(ABORT,'fixture notification failure'); END"
    )
    .run();
  const failingId = crypto.randomUUID();
  const failure = await call('/projects/' + projectId + '/comments', readerSession.id, 'POST', {
    content: '事务测试',
    submissionId: failingId,
  });
  assert.equal(failure.response.status, 500);
  assert.equal(
    await db.prepare('SELECT id FROM project_comments WHERE id=?').bind(failingId).first(),
    null
  );
  await db.prepare('DROP TRIGGER reject_notification').run();
  assert.equal(
    (
      await call('/projects/' + projectId + '/comments', readerSession.id, 'POST', {
        content: '事务测试',
        submissionId: failingId,
      })
    ).response.status,
    200
  );
  await db
    .prepare("UPDATE project_comments SET created_at='2000-01-01T00:00:00Z' WHERE user_id=?")
    .bind(reader)
    .run();
  const concurrentId = crypto.randomUUID();
  const concurrent = await Promise.all([
    call('/projects/' + projectId + '/comments', readerSession.id, 'POST', {
      content: 'Concurrent replay',
      submissionId: concurrentId,
    }),
    call('/projects/' + projectId + '/comments', readerSession.id, 'POST', {
      content: 'Concurrent replay',
      submissionId: concurrentId,
    }),
  ]);
  assert.ok(
    concurrent.every((result) => result.response.status === 200),
    'concurrent stable submission succeeds once and replays'
  );
  assert.equal(
    (
      await db
        .prepare('SELECT COUNT(*) AS n FROM notifications WHERE event_key=?')
        .bind('comment:' + concurrentId)
        .first<{ n: number }>()
    )?.n,
    1
  );
  const prefs = await call('/notification-preferences', readerSession.id);
  assert.equal(prefs.data.pushAvailable, false);
  assert.equal(prefs.data.external.direct, false);
  assert.equal(
    (
      await call('/notification-preferences', readerSession.id, 'PATCH', {
        external: { direct: true },
        timezone: 'Asia/Shanghai',
      })
    ).response.status,
    400,
    'no unsubscribed device opt-in'
  );
  const attemptId = crypto.randomUUID();
  await deploymentRepository.createAttempt(db, {
    id: attemptId,
    projectId,
    ownerId: author,
    sourceType: 'html',
    clientChannel: 'web',
    startedAt: new Date().toISOString(),
  });
  await deploymentRepository.finishAttempt(
    db,
    attemptId,
    'failed',
    new Date().toISOString(),
    10,
    'fixture'
  );
  await deploymentRepository.finishAttempt(
    db,
    attemptId,
    'failed',
    new Date().toISOString(),
    10,
    'fixture'
  );
  assert.equal(
    (await inbox(authorSession.id)).items.filter((item) => item.kind === 'deployment_failure')
      .length,
    1
  );
  console.log(
    'PASS: HTTP comments/replies, retry, read race, reactions/re-add/privacy, other-author favorites, follow/publication, admin feedback, atomic rollback, channel gate, deployment replay'
  );
} finally {
  await mf.dispose();
}
