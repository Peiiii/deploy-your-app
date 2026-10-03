import { authRepository } from '../workers/api/src/repositories/auth.repository';
import { sdkAuthRepository } from '../workers/api/src/repositories/sdk-auth.repository';
import { sdkCloudService } from '../workers/api/src/services/sdk-cloud.service';
import { sdkAuthService } from '../workers/api/src/services/sdk-auth.service';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { PointsRepository } from '../workers/api/src/points/repository';
import { refund, processPointsScheduled, runAi } from '../workers/api/src/points/service';
import { pointsController } from '../workers/api/src/points/controller';
import type { ApiWorkerEnv } from '../workers/api/src/types/env';
import type { PointsItem } from '../workers/api/src/points/types';
const require = createRequire(import.meta.url);
const wranglerRequire = createRequire(require.resolve('wrangler/package.json'));
const { Miniflare } = wranglerRequire('miniflare');
const mf = new Miniflare({
  modules: true,
  script: 'export default {fetch(){return new Response("ok")}}',
  d1Databases: { DB: 'points-test' },
  compatibilityDate: '2026-09-18',
});
try {
  const db = await mf.getD1Database('DB');
  const repo = new PointsRepository(db as D1Database);
  let sql = readFileSync('workers/api/migrations/0006_platform_points.sql', 'utf8')
    .replace(/^--.*$/gm, '')
    .trim();
  while (sql) {
    const end = sql.startsWith('CREATE TRIGGER') ? sql.indexOf('\nEND;') + 5 : sql.indexOf(';') + 1;
    assert.ok(end > 0, 'complete SQL');
    await db.prepare(sql.slice(0, end)).run();
    sql = sql.slice(end).trim();
  }
  const item: PointsItem = {
    id: 'hint',
    project_id: 'app-a',
    author_id: 'author',
    name: '提示',
    description: '提示额度',
    type: 'repeatable',
    price: 2,
    entitlement: 'hint',
    units: 1,
    period_seconds: 0,
    delivery: 'grant',
    enabled: 1,
    created_at: Date.now(),
  };
  async function register(i: PointsItem) {
    await db
      .prepare('INSERT INTO points_items VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(
        i.id,
        i.project_id,
        i.author_id,
        i.name,
        i.description,
        i.type,
        i.price,
        i.entitlement,
        i.units,
        i.period_seconds,
        i.delivery,
        i.enabled,
        i.created_at
      )
      .run();
    return i;
  }
  await db
    .prepare(
      'CREATE TABLE projects(id TEXT PRIMARY KEY,slug TEXT,name TEXT,owner_id TEXT,url TEXT,status TEXT,is_deleted INTEGER)'
    )
    .run();
  await db
    .prepare(
      "INSERT INTO projects VALUES('app-a','knowledge-lab','Knowledge','author','https://knowledge-lab.gemigo.app','Live',0)"
    )
    .run();
  await db
    .prepare(
      "INSERT INTO projects VALUES('app-b','creative-lab','Creative','author','https://creative-lab.gemigo.app','Live',0)"
    )
    .run();
  await register(item);
  const claims = await Promise.all([repo.claim('consumer'), repo.claim('consumer')]);
  assert.equal(claims.filter((c) => !c.alreadyClaimed).length, 1);
  assert.equal((await repo.balance('consumer'))!.balance, 20);
  const bought = await repo.purchase('consumer', item, 'buy-1', null);
  assert.equal(bought.status, 'granted');
  assert.equal(bought.creator_minor, 0);
  assert.equal((await repo.balance('consumer'))!.balance, 18);
  assert.equal((await repo.purchase('consumer', item, 'buy-1', null)).id, bought.id);
  assert.equal((await repo.balance('consumer'))!.balance, 18);
  await assert.rejects(
    repo.purchase('consumer', { ...item, id: 'different' }, 'buy-1', null),
    /另一消费/
  );
  await repo.consume('consumer', 'app-a', bought.id, 'use-1');
  await repo.consume('consumer', 'app-a', bought.id, 'use-1');
  await assert.rejects(repo.consume('consumer', 'app-a', bought.id, 'use-2'), /额度不足/);
  await assert.rejects(refund(repo, bought), /已使用/);
  await assert.rejects(repo.consume('consumer', 'app-b', bought.id, 'bad'), /额度不足/);
  const durable = await register({
    ...item,
    id: 'advanced',
    type: 'durable',
    price: 4,
    entitlement: 'advanced',
  });
  const both = await Promise.all([
    repo.purchase('consumer', durable, 'unlock-1', null),
    repo.purchase('consumer', durable, 'unlock-2', null),
  ]);
  assert.equal(both[0].id, both[1].id);
  assert.equal((await repo.balance('consumer'))!.balance, 14);
  await refund(repo, both[0]);
  await refund(repo, both[0]);
  assert.equal((await repo.balance('consumer'))!.balance, 18);
  assert.equal((await repo.grants('consumer', 'app-a')).durable.length, 0);
  const term = await register({
    ...item,
    id: 'member',
    type: 'term',
    price: 2,
    entitlement: 'member',
    period_seconds: 60,
  });
  const first = await repo.purchase('consumer', term, 'term-1', null);
  const firstExpiry = (await repo.grants('consumer', 'app-a')).terms[0].expires_at as number;
  const second = await repo.purchase('consumer', term, 'term-2', null);
  assert.equal((await repo.grants('consumer', 'app-a')).terms[0].expires_at, firstExpiry + 60000);
  await assert.rejects(refund(repo, first), /后续购买/);
  await refund(repo, second);
  assert.equal((await repo.grants('consumer', 'app-a')).terms[0].expires_at, firstExpiry);
  await refund(repo, first);
  assert.equal((await repo.grants('consumer', 'app-a')).terms.length, 0);
  const other = await register({ ...item, id: 'other', project_id: 'app-b', price: 3 });
  await repo.purchase('consumer', other, 'other-1', null);
  assert.equal((await repo.balance('consumer'))!.balance, 15);
  await assert.rejects(repo.purchase('poor', item, 'no-funds', null), /点数不足/);
  assert.equal(await repo.receipt('poor', 'app-a', 'no-funds'), null);
  // Finalisation cannot succeed without a complete atomic allocation.
  await assert.rejects(
    db.batch([
      db.prepare(
        "INSERT INTO points_receipts(id,user_id,project_id,author_id,item_id,request_id,status,price,created_at,updated_at) VALUES('broken','consumer','app-a','author','hint','broken','prepared',2,1,1)"
      ),
      db.prepare("UPDATE points_receipts SET status='granted' WHERE id='broken'"),
    ])
  );
  assert.equal(await repo.receipt('consumer', 'app-a', 'broken'), null);
  // Concurrent attempts never overdraw even when their initial balance read overlaps.
  const attempts = await Promise.allSettled(
    Array.from({ length: 20 }, (_, i) => repo.purchase('consumer', item, `concurrent-${i}`, null))
  );
  assert.ok(attempts.some((r) => r.status === 'fulfilled'));
  assert.ok((await repo.balance('consumer'))!.balance >= 0);
  await repo.claim('subscriber');
  await db
    .prepare("INSERT INTO points_subscriptions VALUES('sub','subscriber','app-a','member',1,?,?)")
    .bind(Date.now() - 1000, Date.now())
    .run();
  const env = { PROJECTS_DB: db, AUTH_REDIRECT_BASE: 'https://gemigo.io' } as ApiWorkerEnv;
  await Promise.all([processPointsScheduled(env), processPointsScheduled(env)]);
  assert.equal((await repo.balance('subscriber'))!.balance, 18);
  const sub = await db.prepare("SELECT due_at FROM points_subscriptions WHERE id='sub'").first();
  assert.ok(sub.due_at > Date.now());
  await db.prepare("UPDATE points_subscriptions SET active=0,due_at=0 WHERE id='sub'").run();
  await processPointsScheduled(env);
  assert.equal((await repo.balance('subscriber'))!.balance, 18);
  await db.prepare("UPDATE points_subscriptions SET active=1,due_at=0 WHERE id='sub'").run();
  await db.prepare("UPDATE projects SET is_deleted=1 WHERE id='app-a'").run();
  await processPointsScheduled(env);
  assert.equal((await repo.balance('subscriber'))!.balance, 18, 'deleted apps cannot renew');
  assert.equal(
    (await db.prepare("SELECT active FROM points_subscriptions WHERE id='sub'").first()).active,
    0
  );
  await assert.rejects(repo.purchase('subscriber', item, 'deleted-app', null));
  assert.equal(await repo.receipt('subscriber', 'app-a', 'deleted-app'), null);
  await db.prepare("UPDATE projects SET is_deleted=0 WHERE id='app-a'").run();
  await repo.claim('ai-user');
  const ai = await register({ ...item, id: 'explain', delivery: 'ai', price: 3 });
  const reserved = await repo.purchase('ai-user', ai, 'ai-1', JSON.stringify({ topic: '彩虹' }));
  let calls = 0;
  const aiEnv = {
    ...env,
    RECOMMENDATION_AI: {
      run: async () => {
        calls++;
        return { response: '光折射形成彩虹。' };
      },
    },
  } as unknown as ApiWorkerEnv;
  await Promise.all([runAi(aiEnv, repo, reserved), runAi(aiEnv, repo, reserved)]);
  assert.equal(calls, 1);
  await assert.rejects(refund(repo, { ...reserved, status: 'unknown' }, true), /已使用|核查/);
  assert.equal(
    (await repo.balance('ai-user'))!.balance,
    17,
    'stale release cannot refund a delivered AI result'
  );
  assert.equal((await repo.receipt('ai-user', 'app-a', 'ai-1'))!.status, 'granted');
  assert.match((await repo.receipt('ai-user', 'app-a', 'ai-1'))!.result!, /彩虹/);
  const unknown = await repo.purchase('ai-user', ai, 'ai-2', JSON.stringify({ topic: '天文' }));
  const failEnv = {
    ...env,
    RECOMMENDATION_AI: {
      run: async () => {
        throw new Error('network ambiguity');
      },
    },
  } as unknown as ApiWorkerEnv;
  await runAi(failEnv, repo, unknown);
  assert.equal((await repo.receipt('ai-user', 'app-a', 'ai-2'))!.status, 'unknown');
  await runAi(aiEnv, repo, unknown);
  assert.equal(calls, 1);
  await refund(repo, { ...unknown, status: 'unknown' }, true);
  assert.equal((await repo.balance('ai-user'))!.balance, 17);
  const explicit = await repo.purchase('ai-user', ai, 'ai-3', JSON.stringify({ topic: '自然' }));
  await runAi(
    { ...env, RECOMMENDATION_AI: { run: async () => ({}) } } as unknown as ApiWorkerEnv,
    repo,
    explicit
  );
  assert.equal((await repo.receipt('ai-user', 'app-a', 'ai-3'))!.status, 'released');
  assert.equal((await repo.balance('ai-user'))!.balance, 17);
  await assert.rejects(
    pointsController(
      new Request('https://gemigo.io/api/v1/points/claim', {
        method: 'POST',
        headers: { origin: 'https://evil.gemigo.app', 'Content-Type': 'application/json' },
        body: '{}',
      }),
      env,
      db
    ),
    /平台页面/
  );
  await assert.rejects(
    pointsController(
      new Request('https://gemigo.io/api/v1/sdk/points/items', {
        headers: { origin: 'https://evil.gemigo.app' },
      }),
      env,
      db
    ),
    /重新登录/
  );
  await authRepository.createUser(db, {
    id: 'real-api-user',
    email: 'points-test@example.invalid',
  });
  const apiSession = await authRepository.createSession(db, 'real-api-user');
  const appUser = await sdkAuthRepository.ensureAppUserId(db, {
    appId: 'knowledge-lab',
    userId: 'real-api-user',
  });
  await sdkAuthRepository.insertAccessToken(db, {
    token: 'test-app-token',
    appId: 'knowledge-lab',
    appUserId: appUser.appUserId,
    scopes: ['identity:basic', 'points:use', 'storage:rw'],
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  });
  const sdkReq = (path: string, body?: unknown, origin = 'https://knowledge-lab.gemigo.app') =>
    new Request('https://gemigo.io/api/v1/sdk/points' + path, {
      method: body ? 'POST' : 'GET',
      headers: {
        origin,
        authorization: 'Bearer test-app-token',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  const platformReq = (path: string, body?: unknown) =>
    new Request('https://gemigo.io/api/v1/points' + path, {
      method: body ? 'POST' : 'GET',
      headers: {
        origin: 'https://gemigo.io',
        cookie: `session_id=${apiSession.id}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  await pointsController(platformReq('/claim', {}), env, db);
  await assert.rejects(
    pointsController(sdkReq('/items', undefined, 'https://creative-lab.gemigo.app'), env, db),
    /来源/
  );
  await assert.rejects(
    sdkAuthService.authorize(platformReq('/unused', {}), env, db, {
      appId: 'knowledge-lab',
      scopes: ['points:use'],
      codeChallenge: 'challenge',
      openerOrigin: 'https://evil.gemigo.app',
    }),
    /来源/
  );
  const intent = (await (
    await pointsController(
      sdkReq('/intents', {
        itemId: 'hint',
        requestId: 'api-purchase',
        state: 'random-state',
        amount: 0,
      }),
      env,
      db
    )
  ).json()) as { id: string };
  const receiptResponse = await pointsController(
    platformReq('/intents/' + intent.id + '/confirm', {}),
    env,
    db
  );
  assert.equal(receiptResponse.status, 200);
  assert.equal(
    (await repo.balance('real-api-user'))!.balance,
    18,
    'client price cannot alter debit'
  );
  await pointsController(platformReq('/intents/' + intent.id + '/confirm', {}), env, db);
  assert.equal((await repo.balance('real-api-user'))!.balance, 18);
  await assert.rejects(
    pointsController(
      sdkReq('/intents', { itemId: 'other', requestId: 'cross-app', state: 's' }),
      env,
      db
    ),
    /另一应用/
  );
  const again = await pointsController(sdkReq('/receipt?requestId=api-purchase'), env, db);
  assert.equal(((await again.json()) as { status: string }).status, 'granted');
  const noServiceIntent = (await (
    await pointsController(
      sdkReq('/intents', {
        itemId: 'explain',
        requestId: 'missing-ai',
        state: 'ai-state',
        topic: '天空',
      }),
      env,
      db
    )
  ).json()) as { id: string };
  await assert.rejects(
    pointsController(platformReq('/intents/' + noServiceIntent.id + '/confirm', {}), env, db),
    /服务暂不可用/
  );
  assert.equal(await repo.receipt('real-api-user', 'app-a', 'missing-ai'), null);
  assert.equal((await repo.balance('real-api-user'))!.balance, 18);
  await assert.rejects(pointsController(platformReq('/recharge', {}), env, db), /商户/);
  await sdkCloudService.kvSet(sdkReq('/unused'), env, db, {
    key: 'progress',
    value: { lesson: 3 },
  });
  const cloud = await sdkCloudService.kvGet(sdkReq('/unused'), env, db, 'progress');
  assert.deepEqual(cloud.value, { lesson: 3 }, 'existing Cloud storage still works');
  await sdkAuthRepository.insertAccessToken(db, {
    token: 'legacy-token',
    appId: 'legacy-app',
    appUserId: 'legacy-user',
    scopes: ['identity:basic', 'storage:rw'],
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  });
  const legacy = new Request('https://gemigo.io/api/v1/sdk/cloud/kv', {
    headers: { authorization: 'Bearer legacy-token' },
  });
  await sdkCloudService.kvSet(legacy, env, db, { key: 'progress', value: { lesson: 8 } });
  assert.deepEqual((await sdkCloudService.kvGet(legacy, env, db, 'progress')).value, { lesson: 8 });
  assert.deepEqual(
    (await sdkCloudService.kvGet(sdkReq('/unused'), env, db, 'progress')).value,
    { lesson: 3 },
    'storage remains app/user isolated'
  );
  await assert.rejects(pointsController(legacy, env, db));
  await assert.rejects(pointsController(platformReq('/operations'), env, db), /管理员/);
  const issued = await db.prepare('SELECT trial_issued FROM points_settings WHERE id=1').first();
  await db
    .prepare('UPDATE points_settings SET trial_budget=? WHERE id=1')
    .bind(issued.trial_issued + 20)
    .run();
  await repo.claim('last-budget-user');
  await assert.rejects(repo.claim('budget-exhausted'), /预算/);
  assert.equal((await repo.balance('budget-exhausted'))!.balance, 0);
  await db
    .prepare(
      "INSERT INTO points_lots(id,user_id,source_ref,kind,total,remaining,paid_minor,fee_minor,currency,created_at) VALUES('unapproved-paid','cash-user','invalid-provider','paid',20,20,100,1,'CNY',1)"
    )
    .run();
  await assert.rejects(repo.purchase('cash-user', item, 'cash-attempt', null), /真实收费/);
  assert.equal((await repo.balance('cash-user'))!.balance, 20);
  assert.equal(await repo.receipt('cash-user', 'app-a', 'cash-attempt'), null);
  console.log(
    'PASS: Cloud legacy + points tokens, app/user storage isolation, operator access, global subsidy exhaustion, unapproved paid sources rejected'
  );
  console.log(
    'PASS: real platform session + SDK identity → intent → confirm → canonical price → recovery; cross-origin/item and unapproved cash rejected'
  );
  console.log(
    'PASS: actual D1 batches/triggers, trial budget/idempotency, shared wallet, durable concurrency, consume/refund, term/renewal, service recovery and source checks'
  );
} finally {
  await mf.dispose();
}
