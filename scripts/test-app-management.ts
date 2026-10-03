import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import type { ManagementQuery } from '../frontend/src/features/dashboard/utils/select-management-projects';
const require = createRequire(import.meta.url);
const { selectManagementProjects } =
  require('../frontend/src/features/dashboard/utils/select-management-projects.ts') as typeof import('../frontend/src/features/dashboard/utils/select-management-projects');
const { useDashboardStore } =
  require('../frontend/src/features/dashboard/stores/dashboard.store.ts') as typeof import('../frontend/src/features/dashboard/stores/dashboard.store');
import type { Project } from '../frontend/src/types';

const projects: Project[] = [
  {
    id: 'alpha',
    name: 'Alpha',
    repoUrl: 'https://github.com/example/alpha',
    framework: 'React',
    status: 'Live',
    lastDeployed: '2026-10-02T12:00:00Z',
    url: 'https://alpha.gemigo.app',
    description: 'Original description',
    localization: {
      defaultLocale: 'en',
      locales: { 'zh-CN': { name: 'Alpha', description: '中文计时工具' } },
    },
  },
  {
    id: 'beta',
    name: 'Beta',
    repoUrl: 'draft:beta',
    framework: 'Unknown',
    status: 'Failed',
    lastDeployed: '2026-10-03T12:00:00Z',
  },
  {
    id: 'gamma',
    name: 'Gamma',
    repoUrl: 'local-static:gamma',
    framework: 'Vue',
    status: 'Building',
    lastDeployed: '2026-09-01T00:00:00Z',
  },
  {
    id: 'delta',
    name: 'Delta',
    repoUrl: '',
    framework: 'Unknown',
    status: 'Offline',
    lastDeployed: 'Not deployed',
  },
];
const defaults: ManagementQuery = {
  searchQuery: '',
  showFavoritesOnly: false,
  statusFilter: null,
  sortBy: 'recent',
  sortDirection: 'desc',
};
const original = JSON.stringify(projects);
const select = (patch: Partial<ManagementQuery> = {}, language = 'en') =>
  selectManagementProjects(
    projects,
    { ...defaults, ...patch },
    new Set(['alpha', 'beta']),
    language
  ).map((project) => project.id);
assert.deepEqual(select(), ['beta', 'alpha', 'gamma', 'delta']);
assert.deepEqual(select({ sortDirection: 'asc' }), ['delta', 'gamma', 'alpha', 'beta']);
assert.deepEqual(select({ sortBy: 'name', sortDirection: 'asc' }), [
  'alpha',
  'beta',
  'delta',
  'gamma',
]);
assert.deepEqual(select({ sortBy: 'name' }), ['gamma', 'delta', 'beta', 'alpha']);
assert.deepEqual(select({ sortBy: 'status', sortDirection: 'asc' }), [
  'alpha',
  'gamma',
  'beta',
  'delta',
]);
assert.deepEqual(select({ searchQuery: '  ALPHA.GEMIGO  ' }), ['alpha']);
assert.deepEqual(select({ searchQuery: '计时' }, 'zh-CN'), ['alpha']);
assert.deepEqual(select({ searchQuery: '计时' }, 'en'), []);
assert.deepEqual(select({ searchQuery: ' Vue ', statusFilter: 'Building' }), ['gamma']);
assert.deepEqual(select({ showFavoritesOnly: true, statusFilter: 'Live' }), ['alpha']);
assert.deepEqual(select({ showFavoritesOnly: true, statusFilter: 'Offline' }), []);
assert.deepEqual(select({ searchQuery: 'missing' }), []);
assert.equal(
  JSON.stringify(projects),
  original,
  'Filtering and sorting must not mutate the source list'
);
const { actions } = useDashboardStore.getState();
actions.setStatusFilter('Failed');
actions.setSearchQuery('beta');
actions.setShowFavoritesOnly(true);
actions.setSort('name', 'asc');
actions.reset();
const state = useDashboardStore.getState();
assert.equal(state.statusFilter, null);
assert.equal(state.searchQuery, '');
assert.equal(state.showFavoritesOnly, false);
assert.equal(state.sortBy, 'recent');
assert.equal(state.sortDirection, 'desc');
console.log('App management: search, status, favorites, sorting and reset passed.');
