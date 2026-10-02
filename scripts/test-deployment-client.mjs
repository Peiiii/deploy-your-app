import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';

function load(file, name, scope) {
  const source = fs.readFileSync(file, 'utf8').replace(/^import[\s\S]*?;\s*$/gm, '');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const sandbox = {
    exports: {},
    console: { log() {}, error() {} },
    setTimeout,
    clearTimeout,
    Date,
    AbortSignal,
    ...scope,
  };
  vm.runInNewContext(js, sandbox);
  return sandbox.exports[name];
}
const statuses = {
  BUILDING: 'BUILDING',
  FAILED: 'FAILED',
  SUCCESS: 'SUCCESS',
  DEPLOYING: 'DEPLOYING',
};
const i18n = { t: (key, options) => options?.defaultValue ?? key };
function scenario(fetch) {
  const ui = [],
    events = [],
    logs = [],
    writes = [];
  let stream;
  const actions = new Proxy(
    {},
    {
      get: (_, key) =>
        key === 'setDeploymentStatus'
          ? (status) => ui.push(status)
          : key === 'addLog'
            ? (log) => logs.push(log)
            : () => {},
    }
  );
  const Provider = load(
    'frontend/src/services/http/http-deployment-provider.ts',
    'HttpDeploymentProvider',
    {
      APP_CONFIG: { API_BASE_URL: '/api/v1' },
      API_ROUTES: { DEPLOY: '/deploy' },
      DeploymentStatus: statuses,
      i18n,
      fetch,
      EventSource: class {
        constructor() {
          stream = this;
        }
        close() {}
      },
    }
  );
  const Executor = load(
    'frontend/src/features/deployment/managers/deployment-executor.ts',
    'DeploymentExecutor',
    {
      track: (name) => events.push(name),
      useDeploymentStore: { getState: () => ({ actions }) },
      DeploymentStatus: statuses,
      SourceType: { ZIP: 'zip', HTML: 'html', GITHUB: 'github' },
      crypto: webcrypto,
    }
  );
  const executor = new Executor(new Provider(), {
    updateProjectDeployment: (_id, patch) => writes.push(patch),
    loadProjects: async () => {},
  });
  return { executor, ui, events, logs, writes, getStream: () => stream };
}
const project = { id: 'synthetic', name: 'Test', repoUrl: 'archive.zip', sourceType: 'zip' };
const rejected = scenario(async () =>
  Response.json({ error: 'ZIP upload rejected' }, { status: 413 })
);
await assert.rejects(
  rejected.executor.startDeploymentForProject(project, null),
  /ZIP upload rejected/
);
assert.deepEqual(rejected.writes, []);
assert.ok(!rejected.events.includes('deployment_success'));
assert.equal(rejected.ui.at(-1), 'FAILED');

let uploaded = false,
  smallStart = false,
  reconciled = false;
const recovered = scenario(async (url, init) => {
  if (url.endsWith('/deployment-source')) {
    assert.equal(init.body instanceof File, true, 'send the binary file, not Base64 JSON');
    assert.equal(init.body.size, 12 * 1024 * 1024);
    uploaded = true;
    return Response.json({ zipSourceKey: 'temporary-key' });
  }
  if (url.endsWith('/deploy')) {
    const body = JSON.parse(init.body);
    assert.equal(body.zipSourceKey, 'temporary-key');
    assert.equal(body.zipData, undefined);
    smallStart = init.body.length < 1000;
    return Response.json({ deploymentId: 'builder-id' });
  }
  reconciled = true;
  return Response.json({
    type: 'status',
    status: 'SUCCESS',
    projectMetadata: { url: 'https://test.gemigo.app/' },
  });
});
const job = recovered.executor.startDeploymentForProject(
  project,
  new File([new Uint8Array(12 * 1024 * 1024)], 'test.zip')
);
await new Promise((resolve) => setTimeout(resolve, 5));
recovered.getStream().onerror({});
assert.equal((await job).metadata.url, 'https://test.gemigo.app/');
assert.equal(uploaded && smallStart && reconciled, true);
assert.deepEqual(recovered.writes, []);
assert.ok(!recovered.ui.includes('FAILED'));
assert.equal(recovered.events.filter((event) => event === 'deployment_success').length, 1);
console.log(
  'PASS: 413 rejects without false Live/success; binary ZIP upload; lost SSE recovers confirmed success'
);
