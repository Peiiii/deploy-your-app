import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import type { User } from '../frontend/src/types';

// Managers share browser analytics/i18n imports; provide only their startup globals.
const memory = new Map<string, string>();
const storage = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value); }, removeItem: (key: string) => { memory.delete(key); } };
Object.assign(globalThis, {
  document: { referrer: '' }, innerWidth: 1280,
  location: new URL('http://localhost/'), localStorage: storage, sessionStorage: storage,
  window: { fetch: globalThis.fetch, location: new URL('http://localhost/'), localStorage: storage },
});

const require = createRequire(import.meta.url);
const { AuthManager } = require('../frontend/src/features/auth/managers/auth.manager.ts') as typeof import('../frontend/src/features/auth/managers/auth.manager');
const { MyProfileManager } = require('../frontend/src/features/profile/managers/my-profile.manager.ts') as typeof import('../frontend/src/features/profile/managers/my-profile.manager');
const { UIManager } = require('../frontend/src/managers/ui.manager.ts') as typeof import('../frontend/src/managers/ui.manager');
const { useAuthStore } = require('../frontend/src/features/auth/stores/auth.store.ts') as typeof import('../frontend/src/features/auth/stores/auth.store');
const { useProfileNameStore } = require('../frontend/src/features/profile/stores/profile-name.store.ts') as typeof import('../frontend/src/features/profile/stores/profile-name.store');
const { useMyProfileStore } = require('../frontend/src/features/profile/stores/my-profile.store.ts') as typeof import('../frontend/src/features/profile/stores/my-profile.store');
const { default: i18n } = require('../frontend/src/i18n/config.ts') as typeof import('../frontend/src/i18n/config');

await i18n.changeLanguage('zh-CN');
const user = (id: string): User => ({
  id, email: `${id}@example.com`, displayName: null, handle: null,
  avatarUrl: null, providers: { email: true, google: false, github: false },
});
const first = user('first');
const second = user('second');
const auth = new AuthManager();
const profile = new MyProfileManager(auth, new UIManager());
const originalFetch = globalThis.fetch;
const originalError = console.error;
console.error = () => {}; // Expected service/conflict failures are asserted below.

try {
  useAuthStore.setState({ user: first, isLoading: false });
  profile.beginNameSetup();
  useProfileNameStore.setState({ displayName: '小王的工具箱', handle: '@TAKEN-NAME' });
  globalThis.fetch = async () => Response.json({ error: 'This handle is already taken.' }, { status: 400 });
  await profile.savePublicName();
  assert.equal(useProfileNameStore.getState().error, i18n.t('profile.handleTaken'));
  assert.equal(useProfileNameStore.getState().displayName, '小王的工具箱');
  assert.equal(useAuthStore.getState().user?.displayName, null);

  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  await profile.savePublicName();
  assert.equal(useProfileNameStore.getState().error, i18n.t('profile.updateError'));
  assert.equal(useProfileNameStore.getState().isSaving, false);

  let resolveRequest!: (response: Response) => void;
  let calls = 0;
  globalThis.fetch = async (_url, init) => {
    calls++;
    const body = JSON.parse(String(init?.body));
    assert.equal(body.handle, 'taken-name');
    assert.equal(body.displayName, '小王的工具箱');
    return new Promise<Response>((resolve) => { resolveRequest = resolve; });
  };
  const pending = profile.savePublicName();
  await profile.savePublicName();
  assert.equal(calls, 1, 'saving twice must not create concurrent updates');
  profile.dismissNameReminder();
  assert.equal(useProfileNameStore.getState().editingUserId, first.id, 'saving cannot be dismissed');
  assert.equal(useProfileNameStore.getState().dismissedUserIds.includes(first.id), false);
  useAuthStore.setState({ user: second });
  assert.equal(useProfileNameStore.getState().displayName, '', 'account switches clear drafts');
  profile.beginNameSetup();
  useProfileNameStore.setState({ displayName: '第二个账号的草稿' });
  resolveRequest(Response.json({ user: { ...first, displayName: '小王的工具箱', handle: 'taken-name' } }));
  await pending;
  assert.equal(useAuthStore.getState().user?.id, second.id, 'late replies must not replace another account');
  assert.equal(useProfileNameStore.getState().displayName, '第二个账号的草稿');
  assert.equal(useProfileNameStore.getState().error, null);

  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.handle, undefined, 'nickname-only setup must not change the username');
    return Response.json({ user: { ...second, displayName: body.displayName } });
  };
  await profile.savePublicName();
  assert.equal(useAuthStore.getState().user?.displayName, '第二个账号的草稿');
  assert.equal(useProfileNameStore.getState().editingUserId, null);
  profile.dismissNameReminder();
  assert.deepEqual(useProfileNameStore.getState().dismissedUserIds, [second.id]);
  useAuthStore.setState({ user: first });
  assert.equal(useProfileNameStore.getState().dismissedUserIds.includes(first.id), false);
  // The profile response is the authoritative gallery even before the dashboard loads.
  const gallery = { user: first, profile: { bio: 'About me', links: [], pinnedProjectIds: ['one'] }, stats: { publicProjectsCount: 1, totalLikes: 2, totalFavorites: 3 }, projects: [{ id: 'one', name: 'My app', ownerId: first.id }] };
  globalThis.fetch = async () => Response.json(gallery);
  await profile.loadProfile();
  assert.equal(profile.getMyProjects()[0]?.id, 'one');
  assert.equal(useMyProfileStore.getState().bio, 'About me');
  assert.equal(useMyProfileStore.getState().loadError, null);
  useAuthStore.setState({ user: second });
  assert.deepEqual(profile.getMyProjects(), [], 'another account must not see cached gallery data');
  useAuthStore.setState({ user: first });

  globalThis.fetch = async () => { throw new TypeError('offline'); };
  await profile.loadProfile();
  assert.equal(useMyProfileStore.getState().loadError, 'load_failed');
  let writes = 0;
  globalThis.fetch = async () => { writes++; return Response.json({}); };
  await profile.saveProfile();
  assert.equal(writes, 0, 'failed loading must never overwrite the saved profile with empty drafts');

  globalThis.fetch = async () => Response.json(gallery);
  await profile.loadProfile();
  const actions = useMyProfileStore.getState().actions;
  actions.setBio('Updated bio');
  actions.togglePinned('one');
  actions.addLink();
  actions.updateLink(0, 'url', ' https://example.com ');
  globalThis.fetch = async (_url, init) => {
    assert.equal(init?.method, 'PUT');
    const patch = JSON.parse(String(init?.body));
    assert.deepEqual(patch, { bio: 'Updated bio', links: [{ label: null, url: 'https://example.com' }], pinnedProjectIds: [] });
    return Response.json({ profile: patch });
  };
  await profile.saveProfile();
  assert.equal(useMyProfileStore.getState().profileData?.profile.bio, 'Updated bio');
  assert.equal(useMyProfileStore.getState().isSaving, false);
  console.log('PASS canonical profile gallery, account isolation, failed-load save protection and profile draft persistence');
  console.log('PASS localized conflict/network errors, retained drafts, single save, account isolation and nickname-only setup');
} finally {
  globalThis.fetch = originalFetch;
  console.error = originalError;
}
