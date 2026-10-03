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
const generationDeadlines = new Map(); let nextGenerationTimer = 0;
const { DeploymentManager } = load('features/deployment/managers/deployment.manager.ts', {
  '@/types': types,
  '../stores/deployment.store': { useDeploymentStore: store },
  '@/utils/project': projectUtils,
  './project-creator': { ProjectCreator },
  './deployment-store-actions': { DeploymentStoreActions },
  './deployment-executor': { DeploymentExecutor },
  './publication-details': publicationDetails,
  '@/services/project-address': addressErrors,
}, { AbortController, setTimeout(fn, delay) { const id = ++nextGenerationTimer; generationDeadlines.set(id,{fn,delay}); return id; }, clearTimeout(id) { generationDeadlines.delete(id); } });
let creates = 0,
  calls = 0,
  failCreate = false,
  failSave = false,
  failDeploy = false,
  releaseCreate;
let delayedCreation = false;
const projectManager = {
  async loadProjects() {},
  async createDraftProject(name, slug) {
    creates++;
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
