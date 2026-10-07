import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { authRepository } from '../workers/api/src/repositories/auth.repository.ts';
import { projectRepository } from '../workers/api/src/repositories/project.repository.ts';
import { SourceType } from '../workers/api/src/types/project.ts';

const require = createRequire(import.meta.url);
const { Miniflare, Response: MfResponse } = createRequire(require.resolve('wrangler/package.json'))('miniflare');
const AdmZip = createRequire(require.resolve('../server/package.json'))('adm-zip');
const zip = (files: Record<string, string | Buffer>) => {
  const archive = new AdmZip();
  for (const [name, content] of Object.entries(files)) archive.addFile(name, Buffer.from(content));
  return archive.toBuffer();
};
const staticGithub = zip({ 'demo-main/index.html': '<title>Static Github</title><button>OK</button>', 'demo-main/app.js': 'console.log("github");' });
let githubCalls = 0;
const mf = new Miniflare({
  modules: [{ type: 'ESModule', path: 'workers/api/tmp/deployment-worker-test/index.js' }],
  d1Databases: { PROJECTS_DB: 'static-publication-qa' },
  r2Buckets: ['ASSETS'],
  durableObjects: { APP_GATEWAY: { className: 'AppGateway', useSQLite: true } },
  bindings: { DEPLOY_TARGET: 'r2', APPS_ROOT_DOMAIN: 'gemigo.app' },
  outboundService: async (request: Request) => {
    const url = new URL(request.url);
    if (url.hostname === 'api.github.com') { githubCalls++; return new MfResponse(JSON.stringify({ default_branch: 'main' })); }
    if (url.hostname === 'codeload.github.com') { githubCalls++; return new MfResponse(staticGithub); }
    throw new Error(`Unexpected external dependency: ${url.hostname}`);
  },
  compatibilityDate: '2026-09-18',
});
try {
  const db = await mf.getD1Database('PROJECTS_DB'), bucket = await mf.getR2Bucket('ASSETS');
  await db.exec(readFileSync('workers/api/migrations/0007_app_api_gateway.sql', 'utf8').replace(/\n/g, ' '));
  const user = await authRepository.createUser(db, { id: crypto.randomUUID(), email: 'static-publication@example.test', displayName: 'QA' });
  const session = await authRepository.createSession(db, user.id);
  const call = (path: string, init: RequestInit = {}, auth = true) => mf.dispatchFetch(`https://gemigo.test/api/v1${path}`, { ...init, headers: { ...(auth ? { Cookie: `session_id=${session.id}` } : {}), ...init.headers } });
  const json = async (response: Response) => { const text = await response.text(); assert.ok(response.ok, `${response.status}: ${text}`); return JSON.parse(text); };
  const create = async (sourceType: SourceType, repoUrl = 'qa.zip') => projectRepository.createProjectRecord(db, { id: crypto.randomUUID(), ownerId: user.id, name: 'Static QA', slug: `qa-${crypto.randomUUID().slice(0, 8)}`, repoUrl, sourceType, lastDeployed: '', status: 'Offline', framework: 'Unknown', description: 'Keep my description', category: 'Tools', tags: ['qa'], isPublic: false });
  const deploy = async (project: { id: string }, input: Record<string, unknown>) => json(await call('/deploy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: project.id, ...input }) }));
  const upload = async (project: { id: string }, bytes: Buffer) => json(await call(`/projects/${project.id}/deployment-source`, { method: 'PUT', headers: { 'Content-Type': 'application/zip', 'Content-Length': String(bytes.length) }, body: bytes }));
  const finish = async (id: string, expected = 'SUCCESS') => {
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline) {
      const result = await json(await call(`/deployments/${id}/reconcile`, { method: 'POST' }));
      if (['SUCCESS', 'FAILED'].includes(result.status)) { assert.equal(result.status, expected, JSON.stringify(result)); return result; }
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    throw new Error('Durable publication did not settle.');
  };
  const liveFile = async (slug: string, file: string) => {
    const pointer = await (await bucket.get(`apps/${slug}/deployment.json`)).json();
    return bucket.get(`${pointer.prefix}/${file}`);
  };

  const html = await create(SourceType.Html);
  const first = await deploy(html, { sourceType: 'html', htmlContent: '<title>Original</title><button id="go">Go</button>', deploymentFlowId: crypto.randomUUID() });
  const success = await finish(first.deploymentId);
  assert.equal(success.projectMetadata.url, `https://${html.slug}.gemigo.app/`);
  assert.match(await (await liveFile(html.slug!, 'index.html')).text(), /Original/);
  assert.equal((await projectRepository.getProjectById(db, html.id)).description, 'Keep my description');
  assert.equal((await call(`/deployments/${first.deploymentId}/stream`)).headers.get('Content-Type'), 'text/event-stream');
  assert.match(await (await call(`/deployments/${first.deploymentId}/stream`)).text(), /SUCCESS/);
  assert.equal((await call(`/deployments/${first.deploymentId}/reconcile`, { method: 'POST' }, false)).status, 401);
  console.log('PASS HTML / same URL / metadata / SSE / auth');

  const zipped = await create(SourceType.Zip);
  const bytes = zip({ 'site/index.html': '<title>ZIP static</title><script src="app.js"></script>', 'site/app.js': 'console.log("static");', 'site/genai.js': "fetch('https://generativelanguage.googleapis.com/v1beta/models');", 'site/dist/skip.js': "fetch('https://generativelanguage.googleapis.com/v1beta/models');", 'site/.env': 'SECRET', 'site/.npmrc': 'SECRET', 'site/assets/image.svg': '<svg/>' });
  const source = await upload(zipped, bytes);
  const flow = crypto.randomUUID();
  const zipJob = await deploy(zipped, { sourceType: 'zip', zipSourceKey: source.zipSourceKey, deploymentFlowId: flow });
  assert.equal((await deploy(zipped, { sourceType: 'zip', zipSourceKey: source.zipSourceKey, deploymentFlowId: flow })).deploymentId, zipJob.deploymentId);
  await finish(zipJob.deploymentId);
  assert.match(await (await liveFile(zipped.slug!, 'index.html')).text(), /ZIP static/);
  assert.equal(await liveFile(zipped.slug!, '.env'), null);
  assert.equal(await liveFile(zipped.slug!, '.npmrc'), null);
  assert.equal((await liveFile(zipped.slug!, 'assets/image.svg')).httpMetadata.contentType, 'image/svg+xml');
  assert.match(await (await liveFile(zipped.slug!, 'genai.js')).text(), /https:\/\/genai-api.gemigo.io/);
  assert.match(await (await liveFile(zipped.slug!, 'dist/skip.js')).text(), /generativelanguage.googleapis.com/);
  assert.equal(await bucket.head(source.zipSourceKey), null);
  const base64 = await deploy(zipped, { sourceType: 'zip', zipData: bytes.toString('base64') });
  await finish(base64.deploymentId);
  console.log('PASS ZIP / wrapper / legacy Base64 / binary assets / private exclusions / deduplication');

  const ready = await create(SourceType.Zip);
  const readySource = await upload(ready, zip({ 'project/package.json': '{"scripts":{"build":"exit 1"}}', 'project/src/main.ts': 'source', 'project/dist/index.html': '<title>Ready dist</title>', 'project/dist/assets/app.js': 'console.log("ready");' }));
  await finish((await deploy(ready, { zipSourceKey: readySource.zipSourceKey })).deploymentId);
  assert.match(await (await liveFile(ready.slug!, 'index.html')).text(), /Ready dist/);
  assert.equal(await liveFile(ready.slug!, 'package.json'), null);
  console.log('PASS source ZIP with ready dist / no command execution');

  const github = await create(SourceType.GitHub, 'https://github.com/example/demo');
  await finish((await deploy(github, { sourceType: 'github' })).deploymentId);
  assert.match(await (await liveFile(github.slug!, 'index.html')).text(), /Static Github/);
  assert.equal(githubCalls, 2);
  await projectRepository.updateProjectRecord(db, github.id, { repoUrl: 'https://github.com/example/demo/tree/feature/test' });
  await finish((await deploy(github, { sourceType: 'github' })).deploymentId);
  assert.equal(githubCalls, 3);
  console.log('PASS original Github input / default and slash branch');

  const before = await (await bucket.get(`apps/${zipped.slug}/deployment.json`)).text();
  const buildSource = await upload(zipped, zip({ 'package.json': '{"scripts":{"build":"echo UNSAFE"}}', 'index.html': '<script src="/src/main.tsx"></script>', 'src/main.tsx': 'source' }));
  const failure = await finish((await deploy(zipped, { zipSourceKey: buildSource.zipSourceKey })).deploymentId, 'FAILED');
  assert.equal(failure.errorCode, 'source_build_unavailable');
  assert.equal((await projectRepository.getProjectById(db, zipped.id)).status, 'Live', 'failed new source must not disable the old application API');
  assert.equal((await json(await call(`/projects/${zipped.id}/deployment-result`))).status, 'failed');
  assert.equal(await (await bucket.get(`apps/${zipped.slug}/deployment.json`)).text(), before);
  assert.match(await (await liveFile(zipped.slug!, 'index.html')).text(), /ZIP static/);
  console.log('PASS unsupported source build preserves original site');
  const incomplete = await upload(zipped, zip({ 'index.html': '<div id="root"></div>', 'index.tsx': 'const app = <div/>;' }));
  assert.equal((await finish((await deploy(zipped, { zipSourceKey: incomplete.zipSourceKey })).deploymentId, 'FAILED')).errorCode, 'source_build_unavailable');
  assert.equal(await (await bucket.get(`apps/${zipped.slug}/deployment.json`)).text(), before);

  const invalid = await upload(zipped, Buffer.from('not a ZIP'));
  await finish((await deploy(zipped, { zipSourceKey: invalid.zipSourceKey })).deploymentId, 'FAILED');
  assert.equal(await (await bucket.get(`apps/${zipped.slug}/deployment.json`)).text(), before);
  const other = await create(SourceType.Zip);
  assert.equal((await call('/deploy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: other.id, zipSourceKey: source.zipSourceKey }) })).status, 400);
  console.log('PASS invalid archive / source ownership / preserve old site');

  const queued1 = await deploy(html, { sourceType: 'html', htmlContent: '<title>Queued one</title>' });
  const queued2 = await deploy(html, { sourceType: 'html', htmlContent: '<title>Queued two</title>' });
  await finish(queued1.deploymentId); await finish(queued2.deploymentId);
  assert.match(await (await liveFile(html.slug!, 'index.html')).text(), /Queued two/);
  const result = await json(await call(`/projects/${html.id}/deployment-result`));
  assert.equal(result.status, 'succeeded');
  console.log('PASS same-project queue / last result / no SSE required');

  const missingMetadata = await create(SourceType.Html);
  await projectRepository.updateProjectRecord(db, missingMetadata.id, { description: '', category: 'Other', tags: [] });
  await finish((await deploy(missingMetadata, { sourceType: 'html', htmlContent: '<title>Water Planner</title><meta name="description" content="Plan watering by week">' })).deploymentId);
  assert.equal((await projectRepository.getProjectById(db, missingMetadata.id)).description, 'Plan watering by week');
  console.log('PASS automatic metadata enrichment from prepared content');

  for (const project of [html, zipped, ready, github, other, missingMetadata]) {
    const response = await call(`/projects/${project.id}`, { method: 'DELETE' });
    assert.equal(response.status, 204, await response.text());
    assert.equal((await bucket.list({ prefix: `apps/${project.slug}/` })).objects.length, 0);
  }
  console.log('PASS deletion and R2 cleanup without VPS');
  console.log('OK static publication Worker integration checks passed');
} finally { await mf.dispose(); }
