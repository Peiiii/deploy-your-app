import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const frontendRequire = createRequire(new URL('../frontend/package.json', import.meta.url));
function load(path, dependencies, globals = {}) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(`../frontend/src/${path}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  vm.runInNewContext(outputText, {
    module, exports: module.exports, console: { error() {} },
    require(name) {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency ${name}`);
      return dependencies[name];
    },
    ...globals,
  }, { filename: path });
  return module.exports;
}

const storeModule = load('features/explore/stores/explore.store.ts', {
  zustand: frontendRequire('zustand'), '@/constants/app-categories': {},
});
const store = storeModule.useExploreStore;
const pending = [];
const { ExploreManager } = load('features/explore/managers/explore.manager.ts', {
  '@/features/explore/stores/explore.store': storeModule,
  '@/features/explore/stores/app-language.store': { useAppLanguageStore: { getState: () => ({ languages: null, actions: { setAvailable() {} } }) } },
  '@/features/auth/stores/auth.store': { useAuthStore: { getState: () => ({ user: null }) } },
  '@/analytics/collector': { track() {} },
  '@/components/explore-app-card': { mapProjectsToApps: (items) => items },
  '@/services/http/explore-api': { fetchExploreProjects: (options) => new Promise((resolve, reject) => pending.push({ options, resolve, reject })) },
  '@/i18n/config': {},
});
const manager = new ExploreManager({}, {}, {});
const { actions } = store.getState();
const result = (id) => ({ items: id ? [{ id }] : [], page: 1, total: id ? 1 : 0 });
assert.equal(store.getState().isLoading, true, 'First render must not show empty results');
const initial = manager.loadPage(1);
pending[0].resolve(result('initial'));
await initial;
assert.equal(store.getState().isLoading, false);

actions.setActiveCategory('Games');
assert.equal(store.getState().apps.length, 0);
assert.equal(store.getState().isLoading, true, 'Debounce gap must show skeleton, not language empty state');
const oldRequest = manager.loadPage(1);
actions.setActiveCategory('Productivity');
const currentRequest = manager.loadPage(1);
pending[1].resolve(result('stale'));
await oldRequest;
assert.equal(store.getState().isLoading, true, 'Stale response must not finish current loading');
assert.equal(store.getState().apps.length, 0);
pending[2].resolve(result());
await currentRequest;
assert.equal(store.getState().isLoading, false, 'Empty results become visible only after completion');
actions.setActiveCategory('Productivity');
assert.equal(store.getState().isLoading, false, 'Same selection must not start loading without a request');

actions.setSearchQuery('missing');
assert.equal(store.getState().isLoading, true, 'Search debounce must hide previous empty state');
const failed = manager.loadPage(1);
pending[3].reject(new Error('Network failure'));
await failed;
assert.equal(store.getState().error, true);
assert.equal(store.getState().isLoading, false);
actions.setActiveTag('test');
assert.equal(store.getState().isLoading, true);
assert.equal(store.getState().error, false, 'New filters must clear previous failure');
const retry = manager.loadPage(1);
pending[4].resolve(result('recovered'));
await retry;
assert.equal(store.getState().apps[0].id, 'recovered');
assert.equal(store.getState().isLoading, false);
actions.setActiveTag('test');
actions.setSearchQuery('missing');
assert.equal(store.getState().isLoading, false, 'Repeated search/tag must remain settled');
const visibleBeforeIntent = store.getState();
const intentIndex = pending.length;
manager.prefetchCategory('Education');
assert.equal(store.getState(), visibleBeforeIntent, 'Prefetch must not change visible filters/loading/results');
const intentQuery = pending[intentIndex].options;
assert.equal(intentQuery.category, 'Education');
assert.equal(intentQuery.tag, null, 'Category intent must match the tag reset on actual selection');
pending[intentIndex].reject(new Error('Intent failed'));
await Promise.resolve();
await Promise.resolve();
assert.equal(store.getState().error, false, 'Intent failure must not show a visible error');
actions.setActiveCategory('Education');
const selectionIndex = pending.length;
const selection = manager.loadPage(1);
assert.equal(JSON.stringify(pending[selectionIndex].options), JSON.stringify(intentQuery));
pending[selectionIndex].resolve(result('education'));
await selection;
const settledCount = pending.length;
manager.prefetchCategory('Education');
assert.equal(pending.length, settledCount, 'Current category intent must not request unchanged results');
console.log('Explore loading regression passed: debounce, stale response, empty results, failure and recovery.');

let now = 1000;
const network = [];
const { fetchExploreProjects } = load('services/http/explore-api.ts', {
  '../../constants': { APP_CONFIG: { API_BASE_URL: '/api/v1' }, API_ROUTES: { EXPLORE_PROJECTS: '/projects/explore' } },
}, {
  URLSearchParams,
  Date: { now: () => now },
  fetch: (url) => new Promise((resolve, reject) => network.push({ url, resolve, reject })),
});
const base = { languages: ['zh'], category: 'Games', sort: 'recent', page: 1, pageSize: 12 };
const firstRead = fetchExploreProjects(base);
const simultaneous = fetchExploreProjects(base);
assert.equal(firstRead, simultaneous, 'Intent prefetch and click must share one pending request');
assert.equal(network.length, 1);
now += 20_000;
network[0].resolve({ ok: true, json: async () => result('cached') });
await firstRead;
assert.equal((await fetchExploreProjects(base)).items[0].id, 'cached', 'TTL starts after response completion');
assert.equal(network.length, 1);
now += 14_999;
await fetchExploreProjects(base);
assert.equal(network.length, 1);
now += 1;
const expiredRead = fetchExploreProjects(base);
assert.equal(network.length, 2, 'Expired snapshots must request fresh results');
network[1].reject(new Error('Network failure'));
await assert.rejects(expiredRead, /Network failure/);
const recoveredRead = fetchExploreProjects(base);
network[2].resolve({ ok: false });
await assert.rejects(recoveredRead, /Failed to load/);
const retriedRead = fetchExploreProjects(base);
network[3].resolve({ ok: true, json: async () => result('fresh') });
await retriedRead;
for (const change of [
  { languages: ['en'] }, { languages: null }, { category: 'Education' },
  { search: 'query' }, { tag: 'tag' }, { sort: 'popularity' }, { page: 2 }, { pageSize: 36 },
]) {
  const count = network.length;
  const read = fetchExploreProjects({ ...base, ...change });
  assert.equal(network.length, count + 1, 'Every query dimension must isolate its cached result');
  network.at(-1).resolve({ ok: true, json: async () => result(`variant-${count}`) });
  await read;
}
assert.equal((await fetchExploreProjects(base)).items[0].id, 'fresh');
for (let page = 3; page <= 27; page++) {
  const read = fetchExploreProjects({ ...base, page });
  network.at(-1).resolve({ ok: true, json: async () => result(`page-${page}`) });
  await read;
}
const countBeforeEviction = network.length;
const evicted = fetchExploreProjects(base);
assert.equal(network.length, countBeforeEviction + 1, 'Bounded cache must evict older queries');
network.at(-1).resolve({ ok: true, json: async () => result('reloaded') });
await evicted;
console.log('Explore cache passed: pending deduplication, freshness, query isolation, failure retry and capacity.');
