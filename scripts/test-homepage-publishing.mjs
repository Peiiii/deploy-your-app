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
for (const invalid of [
  '',
  'draft:id',
  'local-static:app',
  'https://github.com.evil.test/owner/repo',
  'https://other.test/owner/repo',
  'https://github.com/owner',
  'https://github.com/owner/repo/tree/master',
  'https://token@github.com/owner/repo',
]) {
  assert.equal(normalizeGitHubRepoUrl(invalid), null);
}
const { rankHomeRecommendations } = load('features/home/components/home-explore.ts');
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

const store = load('features/deployment/stores/deployment.store.ts', {
  zustand: frontendRequire('zustand'),
  '@/types': types,
}).useDeploymentStore;
const deploymentDependency = {
  '@/features/deployment/stores/deployment.store': { useDeploymentStore: store },
  '@/types': types,
};
const projectStore = { projects: [] };
const { DeploymentStoreActions } = load(
  'features/deployment/managers/deployment-store-actions.ts',
  { ...deploymentDependency, '@/analytics/collector': { track() {} } }
);
const { ProjectCreator } = load('features/deployment/managers/project-creator.ts', {
  ...deploymentDependency,
  '@/stores/project.store': { useProjectStore: { getState: () => projectStore } },
});
const { DeploymentExecutor } = load('features/deployment/managers/deployment-executor.ts', {
  ...deploymentDependency,
  '@/analytics/collector': { track() {} },
}, { FileReader: class {
  readAsDataURL(file) { this.result = `data:application/zip;base64,${file.base64}`; this.onload(); }
} });
const { DeploymentManager } = load('features/deployment/managers/deployment.manager.ts', {
  '@/types': types,
  '../stores/deployment.store': { useDeploymentStore: store },
  '@/utils/project': projectUtils,
  './project-creator': { ProjectCreator },
  './deployment-store-actions': { DeploymentStoreActions },
  './deployment-executor': { DeploymentExecutor },
});
let creates = 0,
  calls = 0,
  failCreate = false,
  failSave = false,
  failDeploy = false,
  releaseCreate;
let delayedCreation = false;
const projectManager = {
  async createDraftProject(name) {
    creates++;
    if (delayedCreation)
      await new Promise((resolve) => {
        releaseCreate = resolve;
      });
    if (failCreate) return undefined;
    const project = { id: `p${creates}`, name, repoUrl: `draft:p${creates}`, status: 'Offline' };
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
  async startDeployment(project, onLog, onStatus) {
    calls++;
    if (project.sourceType === SourceType.ZIP) assert.equal(project.zipData, 'UEsFBg==');
    assert.equal(project.id, store.getState().activeProjectId);
    if (failDeploy) throw new Error('Build failed');
    if (project.sourceType === SourceType.GITHUB)
      assert.equal(
        projectStore.projects.find((p) => p.id === project.id).repoUrl,
        'https://github.com/owner/repo'
      );
    onStatus(DeploymentStatus.SUCCESS);
    return { metadata: { url: `https://${project.id}.gemigo.app/` } };
  },
};
const manager = new DeploymentManager(provider, projectManager);
const actions = store.getState().actions;
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

const { HttpDeploymentProvider } = load(
  'services/http/http-deployment-provider.ts',
  { '../../types': types, '../../constants': constants },
  { fetch: async () => ({ ok: false }) }
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
  DeploymentStatus.FAILED,
  'HTTP start failures reject instead of becoming Live'
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
