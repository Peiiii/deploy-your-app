import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
import { analyticsRepository } from '../workers/api/src/repositories/analytics.repository';
import { analyticsService } from '../workers/api/src/services/analytics.service';
import { projectRepository } from '../workers/api/src/repositories/project.repository';
import { authRepository } from '../workers/api/src/repositories/auth.repository';
import { SourceType } from '../workers/api/src/types/project';
import type { ApiWorkerEnv } from '../workers/api/src/types/env';
import { buildApiRouter } from '../workers/api/src/routes';

const require = createRequire(realpathSync('workers/api/node_modules/wrangler/package.json'));
const { Miniflare } = require('miniflare');
const mf = new Miniflare({
  modules: true,
  script: 'export default {fetch(){return new Response("local")}}',
  compatibilityDate: '2026-09-18',
  d1Databases: ['PROJECTS_DB'],
});
const originalError = console.error;
console.error = () => {}; // Intentional optional-read/provider failures below.
try {
  const db = (await mf.getD1Database('PROJECTS_DB')) as D1Database;
  const owner = await authRepository.createUser(db, {
    id: crypto.randomUUID(),
    email: 'owner@loading.test',
    displayName: 'Owner',
  });
  const other = await authRepository.createUser(db, {
    id: crypto.randomUUID(),
    email: 'other@loading.test',
    displayName: 'Other',
  });
  const session = await authRepository.createSession(db, owner.id);
  const expired = await authRepository.createSession(db, owner.id, -60);
  const cookie = `session_id=${session.id}`;
  const now = new Date();
  const makeProject = (index: number, ownerId = owner.id) =>
    projectRepository.createProjectRecord(db, {
      id: crypto.randomUUID(),
      ownerId,
      name: `App ${index}`,
      url: index === 0 ? 'https://loading-first.gemigo.app/' : undefined,
      repoUrl: `html:loading-${index}`,
      sourceType: SourceType.Html,
      lastDeployed: now.toISOString(),
      status: index === 0 ? 'Live' : 'Offline',
      framework: 'HTML',
      slug: `loading-${ownerId}-${index}`,
      isPublic: false,
    });
  const projects = await Promise.all(Array.from({ length: 27 }, (_, index) => makeProject(index)));
  const foreign = await makeProject(0, other.id);
  const deleted = await makeProject(28);
  await db.prepare('UPDATE projects SET is_deleted=1 WHERE id=?').bind(deleted.id).run();
  await analyticsRepository.ensureSchema(db);
  const startedAt = new Date(now.getTime() - 86400000).toISOString();
  await db.prepare('INSERT INTO project_analytics_collection VALUES(1,?)').bind(startedAt).run();
  const signal = {
    isBot: false,
    visitorHash: 'a'.repeat(64),
    sessionHash: 'b'.repeat(64),
    dedupeKey: 'c'.repeat(64),
    userAgentFamily: 'browser',
    clientChannel: 'web',
  };
  await analyticsRepository.recordPageView(db, projects[0].slug!, now, signal);
  await analyticsRepository.recordPageView(db, projects[0].slug!, now, {
    ...signal,
    dedupeKey: 'd'.repeat(64),
  });
  await analyticsRepository.recordPageView(db, projects[0].slug!, now, {
    ...signal,
    isBot: true,
    dedupeKey: 'e'.repeat(64),
  });

  const call = async (path: string, requestCookie?: string, database = db) => {
    const request = new Request(`http://api.local/api/v1${path}`, {
      headers: requestCookie ? { cookie: requestCookie } : {},
    });
    const url = new URL(request.url);
    const route = await buildApiRouter({ PROJECTS_DB: database } as ApiWorkerEnv, url).match(
      url.pathname,
      'GET'
    );
    assert.ok(route);
    try {
      return await route.handler(request, route.params);
    } catch (error) {
      return Response.json(
        { error: String(error) },
        { status: (error as { statusCode?: number }).statusCode ?? 500 }
      );
    }
  };
  assert.deepEqual(await (await call('/me?include=projects')).json(), { user: null });
  assert.deepEqual(await (await call('/me?include=projects', `session_id=${expired.id}`)).json(), {
    user: null,
  });
  const normal = (await (await call('/me', cookie)).json()) as {
    user: { id: string };
    projects?: unknown;
  };
  assert.equal(normal.user.id, owner.id);
  assert.equal(normal.projects, undefined);
  const bootstrapResponse = await call('/me?include=projects', cookie);
  assert.equal(bootstrapResponse.headers.get('cache-control'), 'private, no-store');
  const bootstrap = (await bootstrapResponse.json()) as {
    user: { id: string };
    projects: { items: { id: string; ownerId: string }[]; total: number; pageSize: number };
  };
  assert.equal(bootstrap.user.id, owner.id);
  assert.equal(bootstrap.projects.total, 27);
  assert.equal(bootstrap.projects.items.length, 27);
  assert.ok(bootstrap.projects.items.every((project) => project.ownerId === owner.id));
  assert.equal(bootstrap.projects.pageSize, 100);
  // An optional project failure retains the signed-in identity and omits only that expansion.
  const failingDb = {
    prepare(sql: string) {
      if (sql.includes('FROM projects')) throw new Error('project read unavailable');
      return db.prepare(sql);
    },
    batch: db.batch.bind(db),
  } as D1Database;
  const degraded = (await (
    await call('/me?include=projects', cookie, failingDb)
  ).json()) as typeof normal;
  assert.equal(degraded.user.id, owner.id);
  assert.equal(degraded.projects, undefined);

  const bulkPath = `/projects/stats?ids=${projects.map((project) => project.id).join(',')}&range=7d`;
  assert.equal((await call(bulkPath)).status, 401);
  assert.equal((await call(bulkPath, `session_id=${expired.id}`)).status, 401);
  assert.equal(
    (await call(`/projects/stats?ids=${projects[0].id},${foreign.id}`, cookie)).status,
    404
  );
  assert.equal((await call(`/projects/stats?ids=${deleted.id}`, cookie)).status, 404);
  assert.equal(
    (
      await call(
        '/projects/stats?ids=' + Array.from({ length: 101 }, (_, i) => i).join(','),
        cookie
      )
    ).status,
    400
  );
  const bulkResponse = await call(bulkPath, cookie);
  assert.equal(bulkResponse.status, 200);
  assert.equal(bulkResponse.headers.get('cache-control'), 'private, no-store');
  const bulk = ((await bulkResponse.json()) as { stats: Record<string, unknown> }).stats;
  assert.equal(Object.keys(bulk).length, 27);
  for (const project of projects) {
    const single = await (await call(`/projects/${project.id}/stats?range=7d`, cookie)).json();
    assert.deepEqual(
      bulk[project.id],
      single,
      'batch preserves single-project PV/UV/coverage/day contract'
    );
  }
  const thirty = await analyticsService.getProjectStatsForProjects(db, projects, 30);
  assert.equal(thirty[projects[0].id].pageViews, 2);
  assert.equal(thirty[projects[0].id].uniqueVisitors, 1);
  assert.equal(thirty[projects[1].id].pageViews, 0);
  assert.equal(thirty[projects[0].id].points.length, 30);
  await db.prepare('DELETE FROM project_analytics_collection').run();
  assert.equal(
    (await analyticsService.getProjectStatsForProjects(db, projects, 7))[projects[0].id].pageViews,
    null
  );
  // Beyond the first page: batch IDs are independently owner-scoped, not restricted to page 1.
  const extra = await Promise.all(
    Array.from({ length: 78 }, (_, index) => makeProject(index + 100))
  );
  const large = (await (await call('/me?include=projects', cookie)).json()) as typeof bootstrap;
  assert.equal(large.projects.total, 105);
  assert.equal(large.projects.items.length, 100);
  assert.equal((await call(`/projects/stats?ids=${extra.at(-1)!.id}`, cookie)).status, 200);
  console.log(
    'PASS real D1 + HTTP route bootstrap, anonymous/expired/owner/deleted isolation, optional failure, pagination and 7d/30d batch equivalence'
  );

  const storage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  Object.assign(globalThis, {
    document: { referrer: '' },
    innerWidth: 1280,
    location: new URL('http://localhost/'),
    localStorage: storage,
    sessionStorage: storage,
    window: {
      fetch: globalThis.fetch,
      location: new URL('http://localhost/'),
      localStorage: storage,
    },
  });
  const frontendRequire = createRequire(import.meta.url);
  const { AnalyticsManager } = frontendRequire(
    '../frontend/src/managers/analytics.manager.ts'
  ) as typeof import('../frontend/src/managers/analytics.manager');
  const { useAnalyticsStore } = frontendRequire(
    '../frontend/src/stores/analytics.store.ts'
  ) as typeof import('../frontend/src/stores/analytics.store');
  const { useAuthStore } = frontendRequire(
    '../frontend/src/features/auth/stores/auth.store.ts'
  ) as typeof import('../frontend/src/features/auth/stores/auth.store');
  const { ProjectManager } = frontendRequire(
    '../frontend/src/managers/project.manager.ts'
  ) as typeof import('../frontend/src/managers/project.manager');
  const { useProjectStore } = frontendRequire(
    '../frontend/src/stores/project.store.ts'
  ) as typeof import('../frontend/src/stores/project.store');
  useAuthStore.setState({
    user: { id: owner.id } as import('../frontend/src/types').User,
    isLoading: false,
  });
  const frontendStats = thirty[projects[0].id] as import('../frontend/src/types').ProjectStats;
  let resolveBatch!: (stats: Record<string, typeof frontendStats>) => void;
  let calls = 0;
  const manager = new AnalyticsManager({
    getProjectStats: async (_id, range) => ({ ...frontendStats, range }),
    getProjectsStats: () => {
      calls++;
      return new Promise((resolve) => {
        resolveBatch = resolve;
      });
    },
  });
  const one = manager.loadProjectsStats(['first'], '7d');
  await Promise.resolve();
  const duplicate = manager.loadProjectsStats(['first'], '7d');
  assert.equal(calls, 1);
  resolveBatch({ first: { ...frontendStats, range: '7d' } });
  await Promise.all([one, duplicate]);
  await manager.loadProjectsStats(['first'], '7d');
  assert.equal(calls, 1, 'fresh successful stats are reused');
  const realNow = Date.now;
  Date.now = () => realNow() + 61_000;
  const stale = manager.loadProjectsStats(['first'], '7d');
  await Promise.resolve();
  assert.equal(calls, 2);
  resolveBatch({ first: { ...frontendStats, range: '7d' } });
  await stale;
  Date.now = realNow;
  let failureCalls = 0;
  const recovering = new AnalyticsManager({
    getProjectStats: async () => frontendStats,
    getProjectsStats: async () => {
      failureCalls++;
      if (failureCalls === 1) throw new Error('offline');
      return { first: { ...frontendStats, range: '7d' } };
    },
  });
  await recovering.loadProjectsStats(['first']);
  assert.ok(useAnalyticsStore.getState().byProjectId.first.error);
  await recovering.loadProjectsStats(['first']);
  assert.equal(failureCalls, 2);
  assert.equal(useAnalyticsStore.getState().byProjectId.first.error, undefined);
  const race = manager.loadProjectsStats(['first'], '30d');
  await Promise.resolve();
  await manager.loadProjectStats('first', '7d');
  resolveBatch({ first: frontendStats });
  await race;
  assert.equal(
    useAnalyticsStore.getState().byProjectId.first.stats?.range,
    '7d',
    'latest requested period wins over a delayed batch'
  );
  const pendingResolvers: ((stats: Record<string, typeof frontendStats>) => void)[] = [];
  const superseded = new AnalyticsManager({
    getProjectStats: async (_id, range) => ({ ...frontendStats, range }),
    getProjectsStats: () => new Promise((resolve) => pendingResolvers.push(resolve)),
  });
  const oldSeven = superseded.loadProjectsStats(['period']);
  await Promise.resolve();
  await superseded.loadProjectStats('period', '30d');
  const latestSeven = superseded.loadProjectsStats(['period']);
  await Promise.resolve();
  assert.equal(pendingResolvers.length, 2, 'returning to 7d replaces a superseded pending batch');
  pendingResolvers[0]({ period: { ...frontendStats, range: '7d', pageViews: 11 } });
  await oldSeven;
  const joinedLatest = superseded.loadProjectsStats(['period']);
  await Promise.resolve();
  assert.equal(
    pendingResolvers.length,
    2,
    'older completion cannot clear the newer in-flight request'
  );
  pendingResolvers[1]({ period: { ...frontendStats, range: '7d', pageViews: 22 } });
  await Promise.all([latestSeven, joinedLatest]);
  assert.equal(useAnalyticsStore.getState().byProjectId.period.stats?.pageViews, 22);
  const switched = manager.loadProjectsStats(['second']);
  await Promise.resolve();
  useAuthStore.setState({ user: { id: other.id } as import('../frontend/src/types').User });
  resolveBatch({ second: { ...frontendStats, range: '7d' } });
  await switched;
  assert.equal(
    useAnalyticsStore.getState().byProjectId.second.stats,
    null,
    'late bulk replies cannot seed another account'
  );
  const projectManager = new ProjectManager(
    {} as import('../frontend/src/services/interfaces').IProjectProvider
  );
  assert.equal(
    projectManager.seedSessionProjects(
      owner.id,
      bootstrap.projects as import('../frontend/src/types').PaginatedResponse<
        import('../frontend/src/types').Project
      >
    ),
    false
  );
  useAuthStore.setState({ user: { id: owner.id } as import('../frontend/src/types').User });
  assert.equal(
    projectManager.seedSessionProjects(
      owner.id,
      bootstrap.projects as import('../frontend/src/types').PaginatedResponse<
        import('../frontend/src/types').Project
      >
    ),
    true
  );
  assert.equal(useProjectStore.getState().projects.length, 27);
  assert.equal(
    projectManager.seedSessionProjects(owner.id, {
      ...bootstrap.projects,
      page: 1,
      items: [{ ...projects[0], ownerId: other.id }],
    } as import('../frontend/src/types').PaginatedResponse<
      import('../frontend/src/types').Project
    >),
    false
  );
  console.log(
    'PASS manager in-flight coalescing, 60s reuse/expiry, failure retry, period race and account-safe session seeding'
  );
} finally {
  console.error = originalError;
  await mf.dispose();
}
