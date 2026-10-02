import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import type { ProjectComment, User } from '../frontend/src/types';

Object.assign(globalThis, {
  location: new URL('http://localhost/'),
  window: { fetch: globalThis.fetch, location: new URL('http://localhost/') },
});
const require = createRequire(import.meta.url);
const { PreviewCommentsManager } = require('../frontend/src/features/home/managers/preview-comments.manager.ts') as typeof import('../frontend/src/features/home/managers/preview-comments.manager');
const { ProjectManager } = require('../frontend/src/managers/project.manager.ts') as typeof import('../frontend/src/managers/project.manager');
const { HttpProjectProvider } = require('../frontend/src/services/http/http-project-provider.ts') as typeof import('../frontend/src/services/http/http-project-provider');
const { useAuthStore } = require('../frontend/src/features/auth/stores/auth.store.ts') as typeof import('../frontend/src/features/auth/stores/auth.store');
const { useProjectStore } = require('../frontend/src/stores/project.store.ts') as typeof import('../frontend/src/stores/project.store');

const comment = (id: string, canDelete = true): ProjectComment => ({
  id, projectId: 'app/a', content: id, createdAt: '2026-10-03T00:00:00Z', updatedAt: '2026-10-03T00:00:00Z',
  author: { id: 'me', handle: 'me-user', displayName: 'Me', avatarUrl: null }, replyTo: null, canDelete,
});
const page = (items: ProjectComment[], total = items.length) => Response.json({ items, total, page: 1, pageSize: 30 });
const originalFetch = globalThis.fetch;
let loggedIn = false;
let loginRequests = 0;
const manager = new PreviewCommentsManager('app/a', force => {
  if (!force && loggedIn) return true;
  loginRequests++;
  return false;
});
try {
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(String(url), '/api/v1/projects/app%2Fa/comments?page=1&pageSize=30');
    assert.equal(init?.credentials, 'include');
    return page([comment('first')], 32);
  };
  await manager.load();
  assert.equal(manager.store.getState().total, 32);
  manager.setDraft('hello');
  await manager.submit();
  assert.equal(loginRequests, 1);
  assert.equal(calls, 1, 'Guest cannot send a mutation');

  loggedIn = true;
  manager.reply(comment('first'));
  let completePost!: (response: Response) => void;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(String(url), '/api/v1/projects/app%2Fa/comments');
    assert.equal(init?.method, 'POST');
    assert.deepEqual(JSON.parse(String(init?.body)), { content: 'hello', replyToCommentId: 'first' });
    return new Promise(resolve => { completePost = resolve; });
  };
  const submit = manager.submit();
  await manager.submit();
  await manager.load();
  assert.equal(calls, 2, 'No duplicate submit or read racing the write');
  completePost(Response.json({ comment: comment('new') }));
  await submit;
  assert.equal(manager.store.getState().items[0].id, 'new');
  assert.equal(manager.store.getState().draft, '');
  assert.equal(manager.store.getState().replyTo, null);

  globalThis.fetch = async url => {
    assert.match(String(url), /page=2/);
    return page([comment('first'), comment('next')], 33);
  };
  await manager.load(true);
  assert.deepEqual(manager.store.getState().items.map(item => item.id), ['new', 'first', 'next']);

  let completeOld!: (response: Response) => void;
  globalThis.fetch = async () => new Promise(resolve => { completeOld = resolve; });
  const oldRead = manager.load();
  manager.invalidate();
  assert.equal(manager.store.getState().items.length, 0, 'Clear previous identity permissions immediately');
  globalThis.fetch = async () => page([comment('current')]);
  await manager.load();
  completeOld(page([comment('stale')]));
  await oldRead;
  assert.equal(manager.store.getState().items[0].id, 'current');

  let deleteCalls = 0;
  globalThis.fetch = async (_url, init) => {
    if (init?.method === 'DELETE') { deleteCalls++; return new Response(null, { status: 204 }); }
    return page([]);
  };
  await manager.remove(comment('other', false));
  assert.equal(deleteCalls, 0);
  await manager.remove(comment('current'));
  assert.equal(deleteCalls, 1);
  assert.equal(manager.store.getState().items.length, 0, 'Deletion resets server pagination');

  manager.setDraft('keep this draft');
  globalThis.fetch = async () => new Response(null, { status: 401 });
  await manager.submit();
  assert.equal(loginRequests, 2, 'Expired session opens login even with cached identity');
  assert.equal(manager.store.getState().draft, 'keep this draft');
  assert.equal(manager.store.getState().submitting, false);
  assert.equal(manager.store.getState().error, true);
  globalThis.fetch = async () => page([comment('retry')]);
  await manager.load();
  assert.equal(manager.store.getState().error, false);

  useAuthStore.setState({ user: { id: 'me' } as User });
  useProjectStore.getState().actions.reset();
  const projects = new ProjectManager(new HttpProjectProvider());
  globalThis.fetch = async url => {
    const parsed = new URL(String(url), 'http://localhost');
    assert.equal(parsed.searchParams.get('scope'), 'mine');
    const currentPage = Number(parsed.searchParams.get('page'));
    return Response.json({ items: currentPage === 1 ? [] : [{ id: 'target', ownerId: 'me' }], total: 101, page: currentPage, pageSize: 100 });
  };
  await projects.ensureProjectLoaded('target', 'me');
  assert.equal(useProjectStore.getState().projects[0].id, 'target');
  const cached = useProjectStore.getState().projects;
  globalThis.fetch = async () => {
    useAuthStore.setState({ user: { id: 'other' } as User });
    return Response.json({ items: [{ id: 'late', ownerId: 'me' }], total: 1, page: 1, pageSize: 100 });
  };
  await assert.rejects(projects.ensureProjectLoaded('late', 'me'), /Session changed/);
  assert.deepEqual(useProjectStore.getState().projects, cached);
  console.log('Preview actions: comment HTTP/auth/reply/pagination/retry/stale-request and owner-settings boundaries passed.');
} finally {
  globalThis.fetch = originalFetch;
}
