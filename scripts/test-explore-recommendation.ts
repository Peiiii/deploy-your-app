import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { authRepository } from '../workers/api/src/repositories/auth.repository';
import { recommendationReport } from '../workers/api/src/explore-recommendation/report';
import { projectRepository } from '../workers/api/src/repositories/project.repository';
import { feedRequest } from '../workers/api/src/explore-recommendation/service';
import { handleRecommendationOperations } from '../workers/api/src/explore-recommendation/controller';
import {
  settings,
  getBatch,
  features,
  invalidateFeatures,
} from '../workers/api/src/explore-recommendation/repository';
import {
  budgetedModel,
  packVector,
  rankModel,
  EMBEDDING_MODEL,
} from '../workers/api/src/explore-recommendation/model';
import { projectText, revision } from '../workers/api/src/explore-recommendation/ranking';
import { indexPending } from '../workers/api/src/explore-recommendation/indexer';
import type { ApiWorkerEnv } from '../workers/api/src/types/env';

const require = createRequire(import.meta.url);
const wranglerRequire = createRequire(require.resolve('wrangler/package.json'));
const { Miniflare } = wranglerRequire('miniflare');
const mf = new Miniflare({
  modules: true,
  script: 'export default {fetch(){return new Response("ok")}}',
  d1Databases: { DB: 'recommendation-test' },
  compatibilityDate: '2026-09-18',
});
const request = new Request('https://gemigo.test/api/v1/explore-feed');
try {
  const db = await mf.getD1Database('DB');
  await projectRepository.queryPublicFeedItems(db, {});
  await db.batch(
    readFileSync('workers/api/migrations/0005_explore_recommendation.sql', 'utf8')
      .split('\n')
      .filter((l) => !l.startsWith('--'))
      .join('\n')
      .split(';')
      .filter((s) => s.trim())
      .map((sql) => db.prepare(sql))
  );
  let calls = 0;
  let lastQuery = '';
  const env = {
    PROJECTS_DB: db,
    RECOMMENDATION_SECRET: 'test-secret-only',
    RECOMMENDATION_AI: {
      run: async (
        _model: string,
        input: { query?: string; contexts?: Array<{ text: string }>; text?: string[] }
      ) => {
        calls++;
        lastQuery = input.query || '';
        if (input.text)
          return {
            data: input.text.map(() => Array.from({ length: 1024 }, (_, i) => (i === 0 ? 1 : 0))),
          };
        return {
          response: input.contexts!.map((p, i) => ({
            id: i,
            score: p.text.includes('science') ? 1 : 0.1,
          })),
          usage: { prompt_tokens: 100 },
        };
      },
    },
  } as unknown as ApiWorkerEnv;
  assert.deepEqual(await feedRequest(request, env, {}), { enabled: false });
  assert.equal(calls, 0);
  await db
    .prepare("UPDATE explore_rec_settings SET enabled=1,percent=100,ranker='bge' WHERE id=1")
    .run();
  for (let i = 0; i < 90; i++)
    await db
      .prepare(
        `INSERT INTO projects(id,name,repo_url,last_deployed,status,url,is_public,is_deleted,description,category,tags,owner_id,app_language)
    VALUES(?,?, 'repo','2026-10-03','Live',?,1,0,?,?,?, ?,?)`
      )
      .bind(
        `p${i}`,
        i % 3 === 0 ? `Science ${i}` : `Creative ${i}`,
        `https://p${i}.gemigo.app/`,
        i % 3 === 0 ? 'Learn science and physics' : 'Draw colorful art',
        i % 3 === 0 ? 'Education' : 'Creative',
        '["interactive"]',
        `owner${i % 4}`,
        '{"languages":["en"]}'
      )
      .run();
  for (const [id, visible, deleted, status] of [
    ['private', 0, 0, 'Live'],
    ['deleted', 1, 1, 'Live'],
    ['offline', 1, 0, 'Offline'],
  ])
    await db
      .prepare(
        `INSERT INTO projects(id,name,repo_url,last_deployed,status,url,is_public,is_deleted) VALUES(?,?,'repo','2026-10-03',?,'https://private.gemigo.app/',?,?)`
      )
      .bind(id, id, status, visible, deleted)
      .run();
  const catalog = await projectRepository.queryPublicFeedItems(db, {});
  const indexBefore = calls;
  assert.equal((await indexPending(env, 32)).indexed, 32);
  assert.equal(calls, indexBefore + 1);
  await features(db, env.RECOMMENDATION_SECRET);
  for (const p of catalog)
    await db
      .prepare(`INSERT OR REPLACE INTO explore_rec_features VALUES(?,?,?,?,?,0,?)`)
      .bind(
        p.id,
        revision(p),
        EMBEDDING_MODEL,
        projectText(p),
        packVector(
          Array.from({ length: 1024 }, (_, i) =>
            i === (p.category === 'Education' ? 0 : 1) ? 1 : 0
          )
        ),
        Date.now()
      )
      .run();
  const indexedElsewhere = calls;
  assert.equal(
    (await indexPending(env, 32)).indexed,
    0,
    'stale feature cache cannot duplicate already completed index jobs'
  );
  assert.equal(calls, indexedElsewhere);
  invalidateFeatures();
  const first = await feedRequest(request, env, {
    session: 'test-session',
    action: 'feed',
    filters: { languages: ['en'] },
  });
  assert.equal(first.variant, 'treatment');
  assert.equal(first.items.length, 12);
  assert.equal(first.algorithm, 'content');
  assert.equal(calls, indexBefore + 1, 'new visitor does not incur online model calls');
  assert.ok(
    first.items.every(
      (p) => p.isPublic !== false && p.status === 'Live' && !p.isDeleted && !p.htmlContent
    )
  );
  const repeatedInitial = await feedRequest(request, env, {
    token: first.token,
    filters: { languages: ['en'] },
  });
  assert.equal(
    repeatedInitial.items.length,
    12,
    'cancelled initialization cannot consume the catalogue'
  );
  const identity = JSON.parse(atob(first.token.split('.')[0]));
  const firstIds = first.items.map((p) => p.id);
  const initialBatch = await getBatch(db, first.batch, identity.subject);
  assert.ok(initialBatch);
  await assert.rejects(
    () =>
      feedRequest(request, env, {
        token: first.token,
        cursor: first.cursor,
        filters: { category: 'Creative' },
      }),
    /mismatched/
  );
  const next = await feedRequest(request, env, {
    token: first.token,
    cursor: first.cursor,
    filters: { languages: ['en'] },
  });
  assert.ok(next.items.every((p) => !firstIds.includes(p.id)));
  assert.equal(next.batch, first.batch);
  const hide = JSON.parse(initialBatch.items)[24];
  await db.prepare('UPDATE projects SET is_public=0 WHERE id=?').bind(hide).run();
  const afterHidden = await feedRequest(request, env, {
    token: first.token,
    cursor: next.cursor,
    filters: { languages: ['en'] },
  });
  assert.ok(!afterHidden.items.some((p) => p.id === hide), 'fresh delivery rechecks private state');
  const event = {
    id: 'event-one',
    batch: first.batch,
    projectId: first.items[0].id,
    action: 'favorite',
  };
  for (let n = 0; n < 2; n++)
    await feedRequest(request, env, {
      token: first.token,
      action: 'events',
      session: 'test-session',
      events: [event],
    });
  assert.equal(
    (await db.prepare('SELECT COUNT(*) AS n FROM explore_rec_events').first()).n,
    1,
    'event retry idempotent'
  );
  await feedRequest(request, env, {
    token: first.token,
    action: 'events',
    session: 'test-session',
    events: [{ ...event, id: 'forged', projectId: 'private' }],
  });
  assert.equal(
    (await db.prepare('SELECT COUNT(*) AS n FROM explore_rec_events').first()).n,
    1,
    'event must belong to an owned batch'
  );
  const fresh = await feedRequest(request, env, {
    token: first.token,
    filters: { languages: ['en'] },
  });
  assert.equal(fresh.algorithm, 'bge');
  assert.ok(
    lastQuery,
    'history is read even when the positive item is excluded from the next batch'
  );
  await feedRequest(request, env, {
    token: fresh.token,
    action: 'events',
    session: 'test-session',
    events: [
      { id: 'dismiss', batch: fresh.batch, projectId: fresh.items[1].id, action: 'dismiss' },
    ],
  });
  const blocked = await feedRequest(request, env, {
    token: fresh.token,
    filters: { languages: ['en'] },
    cursor: fresh.cursor,
  });
  assert.ok(!blocked.items.some((p) => p.id === fresh.items[1].id));
  assert.ok(
    (await recommendationReport(db)).algorithms.some(
      (g: { algorithm: string }) => g.algorithm === 'bge'
    )
  );
  const forgedToken = first.token.slice(0, -5) + 'aaaaa';
  const forged = await feedRequest(request, env, {
    token: forgedToken,
    filters: { languages: ['en'] },
  });
  assert.notEqual(forged.token, first.token);
  assert.notEqual(JSON.parse(atob(forged.token.split('.')[0])).subject, identity.subject);
  // Clear can land after batch lookup but before a delayed event write.
  const delayedDb = new Proxy(db, {
    get(target, key) {
      if (key === 'batch')
        return async (statements: Parameters<typeof db.batch>[0]) => {
          await feedRequest(request, env, { token: fresh.token, action: 'reset' });
          return target.batch(statements);
        };
      const value = Reflect.get(target, key);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  const late = await feedRequest(request, { ...env, PROJECTS_DB: delayedDb }, {
    token: fresh.token,
    action: 'events',
    session: 'test-session',
    events: [{ id: 'late-event', batch: fresh.batch, projectId: fresh.items[0].id, action: 'open' }],
  });
  assert.equal(late.accepted, 0, 'cleared batch cannot restore preferences from an in-flight event');
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM explore_rec_events WHERE id=?').bind('late-event').first()).n, 0);
  await feedRequest(request, env, { token: first.token, action: 'reset' });
  assert.equal(
    (
      await db
        .prepare('SELECT COUNT(*) AS n FROM explore_rec_events WHERE subject=?')
        .bind(identity.subject)
        .first()
    ).n,
    0
  );
  await db.prepare('UPDATE explore_rec_settings SET percent=0 WHERE id=1').run();
  const control = await feedRequest(request, env, {});
  assert.equal(control.variant, 'control');
  assert.equal(control.algorithm, 'recent');
  const controlAgain = await feedRequest(request, env, {
    token: control.token,
    cursor: control.cursor,
  });
  assert.equal(controlAgain.variant, 'control');
  const dntRequest = new Request(request, { headers: { DNT: '1' } });
  const dnt = await feedRequest(dntRequest, env, { persistent: true });
  assert.equal(dnt.persistent, false);
  assert.ok(dnt.cursor.startsWith('s.'));
  const dntIdentity = JSON.parse(atob(dnt.token.split('.')[0]));
  const dntNext = await feedRequest(dntRequest, env, { token: dnt.token, cursor: dnt.cursor });
  assert.ok(dntNext.items.every((p) => !dnt.items.some((other) => other.id === p.id)));
  assert.equal(
    (
      await db
        .prepare('SELECT COUNT(*) AS n FROM explore_rec_batches WHERE subject=?')
        .bind(dntIdentity.subject)
        .first()
    ).n,
    0
  );
  await feedRequest(dntRequest, env, { token: dnt.token, action: 'events', events: [event] });
  assert.equal(
    (
      await db
        .prepare('SELECT COUNT(*) AS n FROM explore_rec_events WHERE subject=?')
        .bind(dntIdentity.subject)
        .first()
    ).n,
    0
  );
  await assert.rejects(
    () => feedRequest(dntRequest, env, { token: dnt.token, cursor: dnt.cursor.replace(/.$/, '9') }),
    /cursor|snapshot/
  );
  // Existing auth session owns account identity; anonymous history is never merged.
  for (const id of ['account-a', 'account-b'])
    await authRepository.createUser(db, { id, handle: id });
  const accountA = await authRepository.createSession(db, 'account-a');
  const accountB = await authRepository.createSession(db, 'account-b');
  const requestA = new Request(request, { headers: { cookie: `session_id=${accountA.id}` } });
  const requestB = new Request(request, { headers: { cookie: `session_id=${accountB.id}` } });
  const signedIn = await feedRequest(requestA, env, { token: control.token });
  assert.equal(JSON.parse(atob(signedIn.token.split('.')[0])).subject, 'user:account-a');
  await feedRequest(requestA, env, {
    token: signedIn.token,
    action: 'events',
    session: 'account-session',
    events: [
      {
        id: 'account-open',
        batch: signedIn.batch,
        projectId: signedIn.items[0].id,
        action: 'open',
      },
    ],
  });
  const switched = await feedRequest(requestB, env, { token: signedIn.token });
  assert.equal(JSON.parse(atob(switched.token.split('.')[0])).subject, 'user:account-b');
  await assert.rejects(
    () => feedRequest(requestB, env, { token: signedIn.token, cursor: signedIn.cursor }),
    /cursor/
  );
  const loggedOut = await feedRequest(request, env, { token: signedIn.token });
  assert.ok(JSON.parse(atob(loggedOut.token.split('.')[0])).subject.startsWith('anon:'));
  const accountDnt = await feedRequest(
    new Request(requestA, { headers: { cookie: `session_id=${accountA.id}`, DNT: '1' } }),
    env,
    {}
  );
  assert.ok(JSON.parse(atob(accountDnt.token.split('.')[0])).subject.startsWith('anon:'));
  await db.prepare("UPDATE explore_rec_settings SET ranker='content' WHERE id=1").run();
  const learnedScience = await feedRequest(dntRequest, env, {
    mode: 'recommended',
    sessionInterests: [{ projectId: 'p0', action: 'favorite', at: Date.now() }],
  });
  const learnedArt = await feedRequest(dntRequest, env, {
    mode: 'recommended',
    sessionInterests: [{ projectId: 'p1', action: 'favorite', at: Date.now() }],
  });
  assert.equal(learnedScience.items[0].category, 'Education');
  assert.equal(learnedArt.items[0].category, 'Creative');
  const collected = new Set<string>();
  let cursor: string | null = null;
  let traversalToken: string | undefined;
  let complete = false;
  for (let page = 0; page < 20; page++) {
    const response = await feedRequest(request, env, {
      token: traversalToken,
      cursor: cursor || undefined,
      excludeIds: [...collected],
      mode: 'recommended',
    });
    traversalToken = response.token;
    cursor = response.cursor;
    for (const p of response.items) {
      assert.ok(!collected.has(p.id), 'no duplicates through the final batch');
      collected.add(p.id);
    }
    if (!response.hasMore) {
      complete = true;
      break;
    }
  }
  assert.ok(complete, 'pagination terminates');
  assert.equal(collected.size, 89);
  await assert.rejects(
    () => feedRequest(request, env, { filters: { search: [] as unknown as string } }),
    /filter/
  );
  await assert.rejects(
    () =>
      feedRequest(request, env, {
        action: 'events',
        token: control.token,
        session: 'bad-input',
        events: [null as never],
      }),
    /event/
  );
  const report = await recommendationReport(db);
  assert.equal(report.decision, 'insufficient-sample');
  assert.ok(report.groups.some((g) => g.variant === 'control'));
  assert.ok(report.algorithms.some((g: { algorithm: string }) => g.algorithm === 'recent'));
  await db.prepare('UPDATE explore_rec_settings SET enabled=0 WHERE id=1').run();
  const beforeDisabled = calls;
  assert.deepEqual(
    await feedRequest(request, env, { token: control.token, cursor: control.cursor }),
    { enabled: false }
  );
  await indexPending(env);
  assert.equal(calls, beforeDisabled, 'off stops foreground/background AI');
  await assert.rejects(
    () =>
      handleRecommendationOperations(
        new Request('https://gemigo.test/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{"action":"configure","enabled":true}',
        }),
        env
      ),
    /Admin/
  );
  // Real D1 concurrency: conditionally reserve before a model call, no overspend/refund on uncertainty.
  await db.batch([
    db.prepare('DELETE FROM explore_rec_calls'),
    db.prepare('DELETE FROM explore_rec_budget'),
  ]);
  const budgetResults = await Promise.all(
    Array.from({ length: 30 }, () =>
      budgetedModel(db, 20, 'rank', 'test', 1000, async () => ({ tokens: 1000 }), 100)
    )
  );
  assert.equal(budgetResults.filter(Boolean).length, 5);
  assert.equal(
    (await db.prepare('SELECT reserved_micro FROM explore_rec_budget').first()).reserved_micro,
    20
  );
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM explore_rec_calls').first()).n, 5);
  await db.batch([
    db.prepare('DELETE FROM explore_rec_calls'),
    db.prepare('DELETE FROM explore_rec_budget'),
  ]);
  assert.equal(
    await budgetedModel(db, 20, 'rank', 'test', 1000, () => new Promise(() => {}), 5),
    null
  );
  assert.equal(
    (await db.prepare('SELECT reserved_micro FROM explore_rec_budget').first()).reserved_micro,
    4
  );
  assert.equal(
    (await db.prepare('SELECT status FROM explore_rec_calls').first()).status,
    'timeout'
  );
  await db.batch([
    db.prepare('DELETE FROM explore_rec_calls'),
    db.prepare('DELETE FROM explore_rec_budget'),
  ]);
  await budgetedModel(db, 20, 'index', 'unknown-usage', 1000, async () => ({ vectors: [] }), 100);
  assert.equal(
    (await db.prepare('SELECT actual_micro FROM explore_rec_calls').first()).actual_micro,
    null,
    'unknown usage must not be labelled actual cost'
  );
  const invalidEnv = {
    ...env,
    RECOMMENDATION_AI: { run: async () => ({ response: [{ id: 0, score: NaN }] }) },
  } as unknown as ApiWorkerEnv;
  await assert.rejects(() => rankModel(invalidEnv, 'interest', ['one']), /invalid_model_output/);
  assert.equal((await settings(db)).enabled, 0);
  // Removing all module state leaves the authoritative catalogue usable.
  const tables = await db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'explore_rec_%'")
    .all<{ name: string }>();
  for (const table of tables.results) await db.prepare(`DROP TABLE ${table.name}`).run();
  assert.equal((await projectRepository.queryPublicFeedItems(db, {})).length, 89);
  console.log(
    'PASS real D1: account login/switch/logout and no anonymous merge, bilingual content preferences, aggregate report, malformed input, full module removal;  local scope, cold user, interests, stable cursor, private recheck, signed identity, events, negative feedback/reset, control assignment, DNT stateless pagination, disabled jobs, privileged operations, concurrent budget and timeout liability.'
  );
} finally {
  await mf.dispose();
}
