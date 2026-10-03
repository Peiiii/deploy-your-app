import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const frontendRequire = createRequire(new URL('../frontend/package.json', import.meta.url));
const pending = [];
const fetchDouble = (url) => new Promise((resolve) => pending.push({ url, resolve }));

// Assemble the real manager, store and HTTP adapter without rendering React.
// Card projection and unrelated browser services do not affect request ordering.
function loadSource(path, dependencies) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  vm.runInNewContext(outputText, {
    module,
    exports: module.exports,
    require: (name) => {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    fetch: fetchDouble,
    URLSearchParams,
    console,
  }, { filename: path });
  return module.exports;
}

const constants = loadSource('../frontend/src/constants.ts', {});
const store = loadSource('../frontend/src/features/explore/stores/explore.store.ts', {
  zustand: frontendRequire('zustand'),
  '@/constants/app-categories': loadSource('../frontend/src/constants/app-categories.ts', {}),
}).useExploreStore;
const adapter = loadSource('../frontend/src/services/http/explore-api.ts', {
  '../../constants': constants,
});
const { ExploreManager } = loadSource('../frontend/src/features/explore/managers/explore.manager.ts', {
  '@/analytics/collector': { track() {} },
  '@/features/explore/stores/app-language.store': { useAppLanguageStore: { getState: () => ({ languages: null, actions: { setAvailable() {} } }) } },
  '@/features/explore/stores/explore.store': { useExploreStore: store },
  '@/features/auth/stores/auth.store': { useAuthStore: { getState: () => ({ user: null }) } },
  '@/components/explore-app-card': { mapProjectsToApps: (projects) => projects },
  '@/services/http/explore-api': adapter,
  '@/i18n/config': { default: {} },
});
const manager = new ExploreManager({}, {}, { seedCountsFromProjects() {} });
const actions = store.getState().actions;
const result = (category, page = 1, total = 1) => new Response(JSON.stringify({
  items: [{ id: category, name: category, category }], page, pageSize: 12, total,
}), { headers: { 'Content-Type': 'application/json' } });

const oldPage = manager.loadPage(2, true);
actions.setActiveCategory('Education');
assert.equal(store.getState().hasMore, false);
assert.equal(store.getState().apps.length, 0);
pending[0].resolve(result('Fun', 2, 100));
await oldPage;
assert.equal(store.getState().apps.length, 0);
assert.equal(store.getState().page, 1);
assert.equal(store.getState().hasMore, false);

const educationPage = manager.loadPage(1);
assert.match(pending[1].url, /category=Education/);
actions.setActiveCategory('All Apps');
const allPage = manager.loadPage(1);
assert.doesNotMatch(pending[2].url, /category=/);
pending[1].resolve(result('Education'));
await educationPage;
assert.equal(store.getState().isLoading, true);
assert.equal(store.getState().apps.length, 0);
pending[2].resolve(result('Fun'));
await allPage;
assert.equal(store.getState().apps[0].category, 'Fun');
assert.equal(store.getState().page, 1);
assert.equal(store.getState().hasMore, false);
assert.equal(store.getState().isLoading, false);

actions.setActiveCategory('All Apps');
assert.equal(store.getState().apps[0].category, 'Fun');

// Repeated reads reuse the recent page without changing filter or pagination.
const firstRefresh = manager.loadPage(1);
const secondRefresh = manager.loadPage(1);
assert.equal(pending.length, 3);
await Promise.all([firstRefresh, secondRefresh]);
assert.equal(store.getState().apps[0].category, 'Fun');
assert.equal(store.getState().page, 1);
assert.equal(store.getState().hasMore, false);
assert.equal(store.getState().isLoading, false);

// A prefetch and two refreshes share one network response; only the latest
// manager request may settle visible state, even when the promise is shared.
manager.prefetchCategory('Games');
actions.setActiveCategory('Games');
const sharedFirst = manager.loadPage(1);
const sharedSecond = manager.loadPage(1);
assert.equal(pending.length, 4);
pending[3].resolve(result('Games'));
await Promise.all([sharedFirst, sharedSecond]);
assert.equal(store.getState().apps[0].category, 'Games');
assert.equal(store.getState().isLoading, false);

console.log('PASS: category queries, cache/prefetch sharing and stale response protection for apps, pagination and loading.');
