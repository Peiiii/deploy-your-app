import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve('wrangler/package.json'))('esbuild');
const bundle = await build({ entryPoints: ['frontend/src/features/app-detail/managers/app-detail.manager.ts'], bundle: true, write: false, format: 'esm', platform: 'node', alias: { '@': resolve('frontend/src') } });
const { AppDetailManager } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const originalFetch = globalThis.fetch;
try {
  const requests = [];
  globalThis.fetch = (_url, input) => new Promise(resolve => requests.push({ resolve, signal: input.signal }));
  const manager = new AppDetailManager('one');
  const oldLoad = manager.load();
  const newLoad = manager.load();
  assert.equal(requests[0].signal.aborted, true);
  requests[1].resolve(Response.json({ app: { id: 'one', name: 'current' } }));
  await newLoad;
  requests[0].resolve(Response.json({ app: { id: 'one', name: 'stale' } }));
  await oldLoad;
  assert.equal(manager.store.getState().app.name, 'current', 'Late response cannot replace newer work');
  const canceled = manager.load();
  manager.cancel();
  assert.equal(requests[2].signal.aborted, true);
  requests[2].resolve(Response.json({ app: { name: 'unmounted' } }));
  await canceled;
  assert.equal(manager.store.getState().app, null, 'Canceled page cannot acquire stale data');
  globalThis.fetch = async () => new Response('not found', { status: 404 });
  await manager.load();
  assert.equal(manager.store.getState().error, 'not-found');
  globalThis.fetch = async () => { throw new Error('Connection lost'); };
  await manager.load();
  assert.equal(manager.store.getState().error, 'network');
  assert.equal(manager.store.getState().loading, false);
  globalThis.fetch = async () => Response.json({ app: { id: 'one', name: 'recovered' } });
  await manager.load();
  assert.equal(manager.store.getState().error, null);
  assert.equal(manager.store.getState().app.name, 'recovered');
  console.log('PASS: app detail retry, not-found, request replacement and unmount cancellation');
} finally { globalThis.fetch = originalFetch; }

// A failed save must not look successful, even when the follow-up read also fails.
Object.assign(globalThis, { window: { fetch: originalFetch }, document: { referrer: '' }, location: new URL('http://localhost/'), innerWidth: 1280 });
const reactionsBundle = await build({ stdin: { contents: "export { ReactionManager } from './frontend/src/managers/reaction.manager'; export { useReactionStore } from './frontend/src/stores/reaction.store';", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, format: 'esm', platform: 'node', alias: { '@': resolve('frontend/src') } });
const { ReactionManager, useReactionStore } = await import('data:text/javascript;base64,' + Buffer.from(reactionsBundle.outputFiles[0].text).toString('base64'));
const provider = {
  getReactionsForProject: async () => { throw new Error('Read offline'); },
  setLike: async () => { throw new Error('Write offline'); },
  setFavorite: async () => { throw new Error('Write offline'); },
};
const reactions = new ReactionManager(provider);
useReactionStore.getState().actions.patchReactions('one', { likesCount: 7, likedByCurrentUser: false, favoritedByCurrentUser: false });
const originalError = console.error;
try {
  console.error = () => {};
  assert.equal(await reactions.toggleLike('one'), false);
  assert.equal(useReactionStore.getState().byProjectId.one.likedByCurrentUser, false);
  assert.equal(useReactionStore.getState().byProjectId.one.likesCount, 7);
  assert.equal(await reactions.toggleFavorite('one'), false);
  assert.equal(useReactionStore.getState().byProjectId.one.favoritedByCurrentUser, false);
  provider.setFavorite = async () => ({ favoritesCount: 1, likesCount: 7, likedByCurrentUser: false, favoritedByCurrentUser: true });
  assert.equal(await reactions.toggleFavorite('one'), true);
  assert.equal(useReactionStore.getState().byProjectId.one.favoritedByCurrentUser, true);
  console.log('PASS: failed reaction writes roll back and report failure; successful save reports success');
} finally { console.error = originalError; }
