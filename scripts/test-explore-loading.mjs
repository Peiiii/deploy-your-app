import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const frontendRequire = createRequire(new URL('../frontend/package.json', import.meta.url));
function load(path, dependencies) {
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
console.log('Explore loading regression passed: debounce, stale response, empty results, failure and recovery.');
