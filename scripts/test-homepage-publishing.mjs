import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';

const frontendRequire = createRequire(new URL('../frontend/package.json', import.meta.url));
function load(path, dependencies = {}, globals = {}) {
  const { outputText } = ts.transpileModule(
    readFileSync(new URL(`../frontend/src/${path}`, import.meta.url), 'utf8'),
    {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }
  );
  const module = { exports: {} };
  vm.runInNewContext(
    outputText,
    {
      module,
      exports: module.exports,
      process: { env: {} },
      URL,
      crypto: webcrypto,
      console: { log() {}, error() {} },
      require(name) {
        assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency ${name}`);
        return dependencies[name];
      },
      ...globals,
    },
    { filename: path }
  );
  return module.exports;
}
const types = load('types.ts');
const { SourceType, DeploymentStatus } = types;
const constants = load('constants.ts');
const projectUtils = load('utils/project.ts', {
  '../constants': constants,
  '../types': types,
  '@gemigo/public-author': {},
  './thumbnail-url': {},
});
const { normalizeGitHubRepoUrl } = projectUtils;
for (const valid of [
  'https://github.com/owner/repo',
  'github.com/owner/repo.git',
  'git@github.com:owner/repo.git',
]) {
  assert.equal(normalizeGitHubRepoUrl(valid), 'https://github.com/owner/repo');
}
assert.equal(normalizeGitHubRepoUrl('https://github.com/owner/repo/tree/master'), 'https://github.com/owner/repo/tree/master');
for (const invalid of [
  '',
  'draft:id',
  'local-static:app',
  'https://github.com.evil.test/owner/repo',
  'https://other.test/owner/repo',
  'https://github.com/owner',
  'https://token@github.com/owner/repo',
]) {
  assert.equal(normalizeGitHubRepoUrl(invalid), null);
}
const { rankHomeRecommendations } = load('features/home/components/home-explore.ts', { '@/constants/app-categories': load('constants/app-categories.ts') });
const app = (id, name, author, description = 'A useful tool') => ({
  id,
  name,
  description,
  author: { identityKey: author },
});
const candidates = [
  app('1', 'app-draft', 'a', 'A placeholder'),
  app('2', 'Calculator', 'a'),
  app('3', 'Timer', 'a'),
  app('4', 'Math Quest', 'b'),
  app('5', 'Chat', 'c'),
];
const ranked = rankHomeRecommendations(candidates);
assert.equal(new Set(ranked.slice(0, 3).map((a) => a.author.identityKey)).size, 3);
assert.equal(ranked.at(-1).id, '1');
assert.equal(ranked.length, candidates.length);
assert.equal(candidates[0].id, '1', 'Ranking does not mutate its API input');
const withTemporary = rankHomeRecommendations([app('temp', '临时验收', 'd', 'Temporary verification'), ...candidates]);
assert.ok(!withTemporary.slice(0, 3).some(a => a.id === 'temp'), 'Temporary checks do not occupy the first row');

const store = load('features/deployment/stores/deployment.store.ts', {
  zustand: frontendRequire('zustand'),
  '@/types': types,
}).useDeploymentStore;
const deploymentDependency = {
  '@/i18n/config': { default: { t: (key) => key } },
  '@/features/deployment/stores/deployment.store': { useDeploymentStore: store },
  '@/types': types,
};
const projectStore = { projects: [] };
const publicationDetails = load('features/deployment/managers/publication-details.ts', { '@/types': types });
const addressErrors = load('services/project-address.ts');
const requestErrors = load('services/project-request-error.ts', { './project-address': addressErrors });
const { DeploymentStoreActions } = load(
  'features/deployment/managers/deployment-store-actions.ts',
  { ...deploymentDependency, '@/analytics/collector': { track() {} } }
);
const { ProjectCreator } = load('features/deployment/managers/project-creator.ts', {
  ...deploymentDependency,
  '@/stores/project.store': { useProjectStore: { getState: () => projectStore } },
  './publication-details': publicationDetails,
});
const { DeploymentExecutor } = load('features/deployment/managers/deployment-executor.ts', {
  ...deploymentDependency,
  '@/analytics/collector': { track() {} },
}, { FileReader: class {
  readAsDataURL(file) { this.result = `data:application/zip;base64,${file.base64}`; this.onload(); }
} });
const authStore = load('features/auth/stores/auth.store.ts', { zustand: frontendRequire('zustand') }).useAuthStore;
const generationDeadlines = new Map(); let nextGenerationTimer = 0;
const { DeploymentManager } = load('features/deployment/managers/deployment.manager.ts', {
  '@/features/auth/stores/auth.store': { useAuthStore: authStore },
  '@/types': types,
  '../stores/deployment.store': { useDeploymentStore: store },
  '@/utils/project': projectUtils,
  './project-creator': { ProjectCreator },
  './deployment-store-actions': { DeploymentStoreActions },
  './deployment-executor': { DeploymentExecutor },
  './publication-details': publicationDetails,
  '@/services/project-address': addressErrors,
  '@/services/project-request-error': requestErrors,
}, { AbortController, setTimeout(fn, delay) { const id = ++nextGenerationTimer; generationDeadlines.set(id,{fn,delay}); return id; }, clearTimeout(id) { generationDeadlines.delete(id); } });
let creates = 0,
  calls = 0,
  failCreate = false,
  failQuota = false,
  failSave = false,
  failDeploy = false,
  releaseCreate;
let delayedCreation = false;
const projectManager = {
  async loadProjects() {},
  async createDraftProject(name, slug) {
    creates++;
    if (failQuota) throw new requestErrors.ProjectCreationLimitError('Daily limit reached', 20, '2026-10-03T16:00:00Z');
    if (delayedCreation)
      await new Promise((resolve) => {
        releaseCreate = resolve;
      });
    if (failCreate) return undefined;
    const project = { id: `p${creates}`, name, slug, repoUrl: `draft:p${creates}`, status: 'Offline' };
    projectStore.projects.push(project);
    return project;
  },
  async updateProject(id, patch) {
    if (failSave) throw new Error('Save failed');
    const project = projectStore.projects.find((p) => p.id === id);
    Object.assign(project, patch);
    return project;
  },
  async updateProjectDeployment(id, patch) {
    Object.assign(
      projectStore.projects.find((p) => p.id === id),
      patch
    );
  },
};
const provider = {
  async startDeployment(project, onLog, onStatus, options) {
    calls++;
    assert.equal(project.slug, getPublicationSlug(store.getState()), 'Deployment uses the visible address');
    if (project.sourceType === SourceType.ZIP) assert.equal(options.zipFile.base64, 'UEsFBg==');
    assert.equal(project.id, store.getState().activeProjectId);
    if (failDeploy) {
      projectStore.projects.find((p) => p.id === project.id).status = 'Failed';
      throw new Error('Build failed');
    }
    if (project.sourceType === SourceType.GITHUB)
      assert.equal(
        projectStore.projects.find((p) => p.id === project.id).repoUrl,
        'https://github.com/owner/repo'
      );
    Object.assign(projectStore.projects.find((p) => p.id === project.id), { status: 'Live', url: `https://${project.id}.gemigo.app/` });
    onStatus(DeploymentStatus.SUCCESS);
    return { metadata: { url: `https://${project.id}.gemigo.app/` } };
  },
};
const manager = new DeploymentManager(provider, projectManager);
const actions = store.getState().actions;
const { getPublicationSlug, isValidPublicationSlug } = publicationDetails;
manager.initializeNewPublication(SourceType.HTML);
const fallbackAddress = getPublicationSlug(store.getState());
assert.match(fallbackAddress, /^app-[a-f0-9]{8}$/);
actions.setProjectName('旅行账本');
assert.equal(getPublicationSlug(store.getState()), fallbackAddress, 'Chinese names keep a stable automatic address');
actions.setProjectName('My Travel Journal');
assert.equal(getPublicationSlug(store.getState()), 'my-travel-journal');
manager.setPublicationSlug('my-chosen-address');
actions.setProjectName('A different name');
actions.setSourceType(SourceType.ZIP);
assert.equal(getPublicationSlug(store.getState()), 'my-chosen-address', 'Chosen addresses survive name and source changes');
for (const invalid of ['', '-app', 'app-', 'Uppercase', '中文', 'a'.repeat(64)]) assert.equal(isValidPublicationSlug(invalid), false);
for (const valid of ['a', 'my-app', 'a'.repeat(63)]) assert.equal(isValidPublicationSlug(valid), true);

manager.initializeNewPublication(SourceType.HTML);
await assert.rejects(manager.publishNewProject(), /HTML/);
assert.equal(creates, 0);
actions.setHtmlContent('<title>My first page</title><h1>Hello</h1>');
delayedCreation = true;
const first = manager.publishNewProject();
await manager.publishNewProject();
assert.equal(creates, 1, 'Double submit creates one draft');
await assert.rejects(manager.deployProject({ id: 'other' }), /already in progress/);
assert.equal(store.getState().isPublishingNewProject, true);
manager.initializeNewPublication(SourceType.ZIP);
assert.equal(
  store.getState().sourceType,
  SourceType.HTML,
  'Route changes cannot reset an active job'
);
releaseCreate();
await first;
delayedCreation = false;
assert.equal(calls, 1);
assert.equal(projectStore.projects[0].name, 'My first page');
assert.equal(projectStore.projects[0].url, 'https://p1.gemigo.app/');
assert.equal(store.getState().isPublishingNewProject, false);

manager.initializeNewPublication(SourceType.HTML);
actions.setHtmlContent('<h1>Retry example</h1>');
failDeploy = true;
await assert.rejects(manager.publishNewProject(), /Build failed/);
const failedId = store.getState().newProjectId;
assert.equal(store.getState().deploymentStatus, DeploymentStatus.FAILED);
assert.equal(projectStore.projects.find((p) => p.id === failedId).status, 'Failed');
failDeploy = false;
await manager.publishNewProject();
assert.equal(store.getState().newProjectId, failedId);
assert.equal(creates, 2, 'Retry reuses the failed project');
assert.equal(
  projectStore.projects.find((p) => p.id === failedId).url,
  `https://${failedId}.gemigo.app/`
);

manager.initializeNewPublication(SourceType.HTML);
actions.setHtmlContent('<h1>Create failure</h1>');
failCreate = true;
await assert.rejects(manager.publishNewProject(), /create project/);
assert.equal(store.getState().newProjectId, null);
assert.equal(store.getState().isPublishingNewProject, false);
failCreate = false;
await manager.publishNewProject();
assert.equal(store.getState().deploymentStatus, DeploymentStatus.SUCCESS);

manager.initializeNewPublication(SourceType.GITHUB);
actions.setRepoUrl('local-static:demo');
const beforeCreate = creates;
await assert.rejects(manager.publishNewProject(), /GitHub/);
assert.equal(creates, beforeCreate);
actions.setRepoUrl('git@github.com:owner/repo.git');
failSave = true;
const beforeDeploy = calls;
await assert.rejects(manager.publishNewProject(), /Save failed/);
assert.equal(calls, beforeDeploy, 'Do not deploy after a failed metadata save');
failSave = false;
await manager.publishNewProject();
assert.equal(creates, beforeCreate + 1, 'Metadata retry also reuses the draft');
await assert.rejects(
  manager.deployProject({
    id: 'legacy',
    sourceType: SourceType.GITHUB,
    repoUrl: 'local-static:legacy',
  }),
  /GitHub/
);

manager.initializeNewPublication(SourceType.ZIP);
await assert.rejects(manager.publishNewProject(), /ZIP/);
actions.setZipFile({ name: 'shared-page.zip', base64: 'UEsFBg==' });
await manager.publishNewProject();
assert.equal(projectStore.projects.at(-1).name, 'shared-page');
assert.equal(store.getState().deploymentStatus, DeploymentStatus.SUCCESS);

manager.initializeNewPublication(SourceType.HTML);
actions.setHtmlContent('<h1>Address race</h1>');
manager.setPublicationSlug('taken-address');
const originalCreate = projectManager.createDraftProject;
projectManager.createDraftProject = async () => { throw new addressErrors.ProjectAddressError('ADDRESS_TAKEN'); };
const callsBeforeConflict = calls;
await assert.rejects(manager.publishNewProject(), /ADDRESS_TAKEN/);
assert.equal(calls, callsBeforeConflict);
assert.equal(store.getState().publicationAddressError, 'ADDRESS_TAKEN');
assert.equal(store.getState().htmlContent, '<h1>Address race</h1>');
assert.equal(store.getState().newProjectId, null);
assert.equal(store.getState().isPublishingNewProject, false);
manager.setPublicationSlug('available-address');
assert.equal(store.getState().publicationAddressError, null);
projectManager.createDraftProject = originalCreate;
await manager.publishNewProject();
assert.equal(projectStore.projects.at(-1).slug, 'available-address');

const { HttpDeploymentProvider } = load(
  'services/http/http-deployment-provider.ts',
  { '../../types': types, '../../constants': constants, '@/i18n/config': { default: { t: () => 'Failed to start deployment' } } },
  { AbortSignal, setTimeout: (callback) => { callback(); return 0; }, clearTimeout() {}, fetch: async () => Response.json({ error: 'Failed to start deployment' }, { status: 400 }) }
);
let failedStatus;
await assert.rejects(
  new HttpDeploymentProvider().startDeployment(
    {},
    () => {},
    (s) => {
      failedStatus = s;
    },
    { flowId: 'test', clientChannel: 'web' }
  ),
  /start deployment/
);
assert.equal(
  failedStatus,
  undefined,
  'HTTP provider rejects; the deployment executor owns failure state'
);

const outer = { parentElement: null, overflow: 'auto', scrollHeight: 2400, clientHeight: 720 };
const inner = { parentElement: outer, overflow: 'auto', scrollHeight: 2000, clientHeight: 2000 };
const { getScrollParent } = load(
  'utils/scroll.ts',
  {},
  { window: { getComputedStyle: (e) => ({ overflowY: e.overflow }) } }
);
assert.equal(
  getScrollParent({ parentElement: inner }),
  outer,
  'Observer uses the actual bounded scrolling ancestor'
);
console.log(
  'PASS: recommendations, GitHub validation, publication concurrency, failure/retry, exact project identity, HTTP failures and scrolling boundary.'
);

// Drive the real hook through its external request/timer boundary.
{
  let now = 0, nextTimer = 0, stateIndex = 0, previousDeps, cleanup;
  const states = [], timers = new Map(), requests = [];
  const project = { checkAddressAvailability(slug, id, signal) {
    return new Promise((resolve, reject) => requests.push({ slug, signal, resolve, reject }));
  } };
  const window = {
    setTimeout(fn, delay) { const id = ++nextTimer; timers.set(id, { fn, at: now+delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  function advance(ms) {
    const end = now+ms;
    while (true) {
      const due = [...timers].filter(([, timer]) => timer.at<=end).sort((a,b) => a[1].at-b[1].at)[0];
      if (!due) break;
      now = due[1].at; timers.delete(due[0]); due[1].fn();
    }
    now = end;
  }
  const react = {
    useState(initial) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = initial;
      return [states[index], value => { states[index] = typeof value==='function' ? value(states[index]) : value; }];
    },
    useEffect(effect, deps) {
      if (!previousDeps || deps.some((dep,i) => !Object.is(dep,previousDeps[i]))) {
        cleanup?.(); previousDeps = deps; cleanup = effect();
      }
    },
  };
  const { usePublicationAddress } = load('features/deployment/hooks/use-publication-address.ts', {
    react, '@/contexts/presenter-context': { usePresenter: () => ({ project }) },
    '../managers/publication-details': { isValidPublicationSlug: slug => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) },
  }, { window, AbortController });
  const render = (slug='app') => { stateIndex=0; return usePublicationAddress(slug,null,null); };
  assert.equal(render().status, 'checking');
  advance(299); assert.equal(requests.length,0);
  advance(1); advance(7999); assert.equal(render().status,'checking');
  advance(1); assert.equal(render().status,'error'); assert.equal(requests[0].signal.aborted,true);
  requests[0].resolve({ available:true, domain:'gemigo.app' });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(render().status,'error','Late timeout responses cannot turn green');
  render().retry(); assert.equal(render().status,'checking'); advance(300);
  requests[1].resolve({ available:false,domain:'gemigo.app',suggestion:'app-141' });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(render().suggestion,'app-141'); assert.equal(render().status,'taken');
  render('other'); advance(300); render('latest'); assert.equal(requests[2].signal.aborted,true);
  requests[2].resolve({available:true,domain:'gemigo.app'});
  await Promise.resolve(); await Promise.resolve();
  assert.equal(render('latest').status,'checking','Changing the address discards the old response');
  advance(300); requests[3].resolve({available:true,domain:'gemigo.app'});
  await Promise.resolve(); await Promise.resolve();
  assert.equal(render('latest').status,'available');
  cleanup(); assert.equal(timers.size,0,'Unmount clears debounce and deadline');
  console.log('PASS: address check debounce, 8-second timeout, late response, retry and cancellation.');
}

{
  manager.initializeNewPublication(SourceType.HTML);
  manager.setProjectName('旅行账本');
  manager.setPublicationSlug('my-own-address');
  const requests = [];
  projectManager.generateAddressSuggestion = (name, id, signal) => new Promise((resolve,reject) => requests.push({name,id,signal,resolve,reject}));
  const first = manager.generatePublicationAddress();
  assert.equal(store.getState().isGeneratingAddress,true);
  assert.equal(getPublicationSlug(store.getState()),'my-own-address','AI loading preserves current input');
  await manager.generatePublicationAddress(); assert.equal(requests.length,1,'No duplicate generation');
  manager.setPublicationSlug('typed-while-generating');
  assert.equal(requests[0].signal.aborted,true);
  const second = manager.generatePublicationAddress();
  requests[0].resolve({slug:'old-ai-result',domain:'gemigo.app'}); await first;
  assert.equal(store.getState().isGeneratingAddress,true,'Old cleanup cannot stop a newer generation');
  assert.equal(getPublicationSlug(store.getState()),'typed-while-generating');
  requests[1].resolve({slug:'travel-journal',domain:'gemigo.app'}); await second;
  assert.equal(getPublicationSlug(store.getState()),'travel-journal');
  assert.equal(store.getState().projectName,'旅行账本');
  const failure = manager.generatePublicationAddress(); requests[2].reject(new Error('Upstream unavailable')); await failure;
  assert.equal(store.getState().addressGenerationFailed,true); assert.equal(getPublicationSlug(store.getState()),'travel-journal');
  const timeout = manager.generatePublicationAddress();
  const timer = [...generationDeadlines.values()][0]; assert.equal(timer.delay,15000); timer.fn();
  assert.equal(store.getState().addressGenerationFailed,true); assert.equal(store.getState().isGeneratingAddress,false);
  requests[3].resolve({slug:'too-late',domain:'gemigo.app'}); await timeout;
  assert.equal(getPublicationSlug(store.getState()),'travel-journal');
  const renamed = manager.generatePublicationAddress(); manager.setProjectName('新的名称');
  requests[4].resolve({slug:'old-name-result',domain:'gemigo.app'}); await renamed;
  assert.equal(getPublicationSlug(store.getState()),'travel-journal');
  const sourceChanged = manager.generatePublicationAddress(); manager.handleSourceChange(SourceType.ZIP);
  requests[5].resolve({slug:'wrong-source',domain:'gemigo.app'}); await sourceChanged;
  assert.equal(getPublicationSlug(store.getState()),'travel-journal');
  const leaving = manager.generatePublicationAddress(); manager.cancelAddressGeneration();
  requests[6].resolve({slug:'after-exit',domain:'gemigo.app'}); await leaving;
  assert.equal(getPublicationSlug(store.getState()),'travel-journal'); assert.equal(generationDeadlines.size,0);
  console.log('PASS: actual generation manager: success/name preservation, failure, 15-second timeout, late result, manual edit, rename, source change and exit cancellation.');
}

{
  authStore.setState({ user: { id: 'recent-owner' }, isLoading: false });
  manager.initializeNewPublication(SourceType.HTML);
  actions.setHtmlContent('<title>My existing work</title><h1>Changed</h1>');
  actions.setProjectName('New draft name');
  actions.setPublicationSlug('draft-address');
  actions.setNewProjectId('already-saved-draft');
  const oldApp = { id: 'original-app', ownerId: 'recent-owner', name: 'Original', slug: 'original-address', url: 'https://original-address.gemigo.app/' };
  assert.equal(manager.prepareExistingUpdate({ ...oldApp, ownerId: 'someone-else' }), false);
  actions.setDeploymentStatus(DeploymentStatus.BUILDING);
  assert.equal(manager.prepareExistingUpdate(oldApp), false, 'Cannot navigate away from an active publication');
  actions.setDeploymentStatus(DeploymentStatus.IDLE);
  assert.equal(manager.prepareExistingUpdate(oldApp), true);
  assert.equal(store.getState().newProjectId, null, 'Update does not retain the new-project identity');
  const input = manager.getPendingUpdateContent(oldApp.id);
  assert.equal(input.htmlContent, '<title>My existing work</title><h1>Changed</h1>');
  assert.equal(Object.hasOwn(input, 'projectName'), false);
  assert.equal(Object.hasOwn(input, 'publicationSlug'), false, 'Import cannot replace the old app address');
  assert.equal(manager.getPendingUpdateContent('another-app'), null);
  manager.resumeNewPublication(SourceType.ZIP);
  assert.equal(store.getState().sourceType, SourceType.HTML);
  assert.equal(store.getState().newProjectId, 'already-saved-draft');
  assert.equal(store.getState().publicationSlug, 'draft-address');
  assert.equal(store.getState().projectName, 'New draft name');
  manager.initializeNewPublication(SourceType.ZIP);
  const zipFile = { name: 'my-app.zip' };
  actions.setZipFile(zipFile);
  assert.equal(manager.prepareExistingUpdate(oldApp), true);
  assert.equal(manager.getPendingUpdateContent(oldApp.id).zipFile, zipFile);
  manager.resumeNewPublication(SourceType.HTML);
  assert.equal(store.getState().zipFile, zipFile, 'File survives same-session navigation');
  manager.initializeNewPublication(SourceType.GITHUB);
  actions.setRepoUrl('https://github.com/owner/repo');
  manager.prepareExistingUpdate(oldApp);
  assert.equal(manager.getPendingUpdateContent(oldApp.id).repoUrl, 'https://github.com/owner/repo');
  authStore.setState({ user: null });
  authStore.setState({ user: { id: 'recent-owner' } });
  assert.equal(manager.getPendingUpdateContent(oldApp.id), null, 'Logout permanently discards the navigation snapshot');
  manager.resumeNewPublication(SourceType.HTML);
  assert.equal(store.getState().htmlContent, '');

  const actualProjectStore = load('stores/project.store.ts', { zustand: frontendRequire('zustand') }).useProjectStore;
  const { ProjectManager } = load('managers/project.manager.ts', {
    '../stores/project.store': { useProjectStore: actualProjectStore },
    '@/features/auth/stores/auth.store': { useAuthStore: authStore },
    '@/analytics/collector': { track() {} },
    '../types': types,
  });
  const pending = [];
  const privateProvider = { getProjects(page, pageSize) {
    assert.equal(page, 1); assert.equal(pageSize, 6);
    return new Promise((resolve, reject) => pending.push({ resolve, reject }));
  } };
  const privateManager = new ProjectManager(privateProvider);
  actualProjectStore.setState({ projects: [{ id: 'dashboard-item' }, { ...oldApp, url: undefined, status: 'Building' }], pagination: { page: 2, pageSize: 50, total: 101, hasMore: true } });
  const first = privateManager.loadRecentProjects('recent-owner');
  const second = privateManager.loadRecentProjects('recent-owner');
  pending[1].resolve({ items: [oldApp, { ...oldApp, id: 'foreign', ownerId: 'other' }] });
  await second;
  pending[0].resolve({ items: [{ ...oldApp, id: 'stale' }] });
  await first;
  assert.equal(actualProjectStore.getState().recentProjects[0].id, 'original-app');
  assert.equal(actualProjectStore.getState().recentProjects.length, 1);
  assert.equal(actualProjectStore.getState().projects[0].id, 'dashboard-item');
  assert.equal(actualProjectStore.getState().projects[1].url, oldApp.url, 'Recent metadata refreshes already cached entities without replacing list membership');
  assert.equal(actualProjectStore.getState().pagination.page, 2, 'Recent query does not corrupt dashboard pagination');
  const late = privateManager.loadRecentProjects('recent-owner');
  authStore.setState({ user: { id: 'other' } });
  const newAccount = privateManager.loadRecentProjects('other');
  pending[3].resolve({ items: [] });
  await newAccount;
  pending[2].resolve({ items: [oldApp] });
  await late;
  assert.equal(actualProjectStore.getState().recentProjects.length, 0);
  assert.equal(actualProjectStore.getState().recentOwnerId, 'other');
  const failure = privateManager.loadRecentProjects('other');
  pending[4].reject(new Error('Offline'));
  await failure;
  assert.equal(actualProjectStore.getState().recentError, true);
  assert.equal(actualProjectStore.getState().recentLoading, false);
  await privateManager.loadRecentProjects(null);
  assert.equal(actualProjectStore.getState().recentOwnerId, null);
  console.log('PASS: existing app update navigation, HTML/ZIP/GitHub transfer, draft identity recovery, busy/ownership guards, logout reset and bounded recent requests with stale-response/account isolation.');
}

manager.initializeNewPublication(SourceType.HTML);
actions.setHtmlContent('<h1>Keep my content at quota</h1>');
actions.setProjectName('Keep my name');
manager.setPublicationSlug('keep-my-address');
failQuota = true;
const quotaDeployCalls = calls;
await assert.rejects(manager.publishNewProject(), requestErrors.ProjectCreationLimitError);
assert.equal(store.getState().htmlContent, '<h1>Keep my content at quota</h1>');
assert.equal(store.getState().projectName, 'Keep my name');
assert.equal(getPublicationSlug(store.getState()), 'keep-my-address');
assert.equal(store.getState().newProjectId, null);
assert.equal(store.getState().isPublishingNewProject, false);
assert.equal(store.getState().deploymentStatus, DeploymentStatus.IDLE);
assert.equal(calls, quotaDeployCalls, 'Quota rejection never starts a deployment');
const existingDraft = projectStore.projects[0];
actions.setNewProjectId(existingDraft.id);
manager.setPublicationSlug(existingDraft.slug);
const quotaCreateCalls = creates;
await manager.publishNewProject();
assert.equal(creates, quotaCreateCalls, 'Existing draft retry bypasses creation quota');
assert.equal(calls, quotaDeployCalls + 1);
assert.equal(store.getState().newProjectId, existingDraft.id);
console.log('PASS: quota keeps content, name and address, releases busy state, and allows existing draft deployment.');
