import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const frontendRequire = createRequire(new URL('../frontend/package.json', import.meta.url));
const filename = '../frontend/src/stores/ui.store.ts';
const { outputText } = ts.transpileModule(readFileSync(new URL(filename, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const key = 'gemigo-ui-preferences';
const values = new Map([['i18nextLng', 'zh']]);
const storage = {
  getItem: (name) => values.get(name) ?? null,
  setItem: (name, value) => values.set(name, value),
  removeItem: (name) => values.delete(name),
};

function reload(localStorage = storage) {
  const module = { exports: {} };
  // Load both the real store and real persist middleware afresh, as on page reload.
  const context = vm.createContext({ module, exports: module.exports, localStorage, window: {}, console });
  context.require = (name) => {
    if (name === 'zustand') return frontendRequire(name);
    assert.equal(name, 'zustand/middleware');
    const middleware = { exports: {} };
    vm.runInNewContext(readFileSync(frontendRequire.resolve(name), 'utf8'), {
      module: middleware, exports: middleware.exports, localStorage, console,
    }, { filename: name });
    return middleware.exports;
  };
  vm.runInContext(outputText, context, { filename });
  return module.exports.useUIStore;
}

let store = reload();
assert.equal(store.getState().sidebarCollapsed, false);
store.getState().actions.toggleSidebarCollapsed();
store = reload();
assert.equal(store.getState().sidebarCollapsed, true, 'Collapsed sidebar must survive reload');
store.getState().actions.toggleSidebarCollapsed();
store = reload();
assert.equal(store.getState().sidebarCollapsed, false, 'Expanded sidebar must survive reload');
store.getState().actions.setSidebarCollapsed(true);
store.getState().actions.setSidebarOpen(true);
store.getState().actions.showToast({ message: 'temporary', variant: 'info' });
store.getState().actions.openRightPanel({ preview: true }, 'preview', 'app');
assert.deepEqual(JSON.parse(values.get(key)).state, { sidebarCollapsed: true });
store = reload();
assert.equal(store.getState().sidebarCollapsed, true);
assert.equal(store.getState().sidebarOpen, false);
assert.equal(store.getState().toast, null);
assert.equal(store.getState().rightPanelContent, null);
assert.equal(store.getState().language, 'zh');
assert.equal(typeof store.getState().actions.toggleSidebarCollapsed, 'function');

for (const stored of ['{broken', JSON.stringify({ state: { sidebarCollapsed: 'true' }, version: 0 }),
  JSON.stringify({ state: null, version: 0 })]) {
  values.set(key, stored);
  store = reload();
  assert.equal(store.getState().sidebarCollapsed, false);
  store.getState().actions.toggleSidebarCollapsed();
  assert.equal(reload().getState().sidebarCollapsed, true);
}
values.set(key, JSON.stringify({ state: { sidebarCollapsed: false, sidebarOpen: true, actions: null }, version: 0 }));
store = reload();
assert.equal(store.getState().sidebarOpen, false);
assert.equal(typeof store.getState().actions.toggleSidebarCollapsed, 'function');

const disabledStorage = {
  getItem() { throw new Error('Storage blocked'); },
  setItem() { throw new Error('Storage full'); },
  removeItem() { throw new Error('Storage blocked'); },
};
for (const unavailable of [disabledStorage, null]) {
  store = reload(unavailable);
  store.getState().actions.toggleSidebarCollapsed();
  assert.equal(store.getState().sidebarCollapsed, true);
  store.getState().actions.setSidebarCollapsed(false);
  assert.equal(store.getState().sidebarCollapsed, false);
}
console.log('PASS: sidebar reload restoration, transient state isolation and storage failure recovery.');
