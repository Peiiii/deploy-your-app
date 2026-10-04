import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { deploymentSourceService } from '../workers/api/src/services/deployment-source.service';

const directory = mkdtempSync(path.join(tmpdir(), 'gemigo-storage-test-'));
process.env.STORAGE_TYPE = 'file';
process.env.DATA_DIR = directory;
process.env.DEPLOY_TARGET = 'r2';
process.env.R2_ACCOUNT_ID = 'qa-account';
process.env.R2_BUCKET_NAME = 'qa-bucket';
process.env.R2_ACCESS_KEY_ID = 'qa-key';
process.env.R2_SECRET_ACCESS_KEY = 'qa-secret';
const require = createRequire(new URL('../server/package.json', import.meta.url));
const { S3Client } = require('@aws-sdk/client-s3');
const objects = new Map<string, string>();
let failDeletes = false;
let pauseUpload: (() => Promise<void>) | undefined;
// A protocol double consumes the actual AWS commands emitted by the provider.
S3Client.prototype.send = async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
  const input = command.input;
  if (command.constructor.name === 'PutObjectCommand') {
    if (pauseUpload && String(input.Key).endsWith('/index.html')) await pauseUpload();
    const chunks = [];
    if (typeof input.Body === 'string') chunks.push(Buffer.from(input.Body));
    else for await (const chunk of input.Body as AsyncIterable<Buffer>) chunks.push(chunk);
    objects.set(String(input.Key), Buffer.concat(chunks).toString());
    return {};
  }
  if (command.constructor.name === 'GetObjectCommand') {
    const text = objects.get(String(input.Key));
    if (text === undefined) throw Object.assign(new Error('Missing'), { name: 'NoSuchKey' });
    return { Body: { transformToString: async () => text } };
  }
  if (command.constructor.name === 'DeleteObjectsCommand') {
    if (failDeletes) return { Errors: [{ Code: 'InternalError' }] };
    for (const item of (input.Delete as { Objects: { Key: string }[] }).Objects) objects.delete(item.Key);
    return {};
  }
  if (command.constructor.name === 'ListObjectsV2Command') {
    const root = String(input.Prefix);
    const keys = [...objects.keys()].filter(key => key.startsWith(root));
    const grouped = input.Delimiter ? [...new Set(keys.map(key => {
      const relative = key.slice(root.length); const slash = relative.indexOf('/');
      return slash < 0 ? null : root + relative.slice(0, slash + 1);
    }).filter(Boolean))] as string[] : keys;
    const page = grouped.sort().filter(key => !input.ContinuationToken || key > String(input.ContinuationToken)).slice(0, 2);
    const more = grouped.some(key => page.length && key > page.at(-1)!);
    return {
      ...(input.Delimiter ? { CommonPrefixes: page.map(Prefix => ({ Prefix })) } : { Contents: page.map(Key => ({ Key })) }),
      IsTruncated: more, NextContinuationToken: more ? page.at(-1) : undefined,
    };
  }
  throw new Error(`Unexpected command ${command.constructor.name}`);
};

try {
  const { cleanAppStorage } = await import('../server/src/modules/deployment/providers/r2Provider');
  const ids = Array.from({ length: 5 }, () => randomUUID());
  const root = 'apps/storage-qa/';
  for (const id of ids) for (let i = 0; i < 5; i++) objects.set(`${root}releases/${id}/file-${i}`, 'asset');
  objects.set(`${root}current/index.html`, 'old legacy');
  objects.set(`${root}deployment.json`, JSON.stringify({ prefix: `${root}releases/${ids[4]}`, previousPrefix: `${root}releases/${ids[3]}` }));
  objects.set(`${root}thumbnail.webp`, 'cover');
  objects.set('apps/another/current/index.html', 'other owner');
  failDeletes = true;
  await assert.rejects(cleanAppStorage('storage-qa', ids[0], false, () => {}), /cleanup will retry/);
  failDeletes = false;
  await cleanAppStorage('storage-qa', ids[0], false, () => {});
  for (const id of ids.slice(0, 3)) assert.equal([...objects.keys()].some(key => key.includes(id)), false);
  for (const id of ids.slice(3)) assert.equal([...objects.keys()].filter(key => key.includes(id)).length, 5);
  assert.equal(objects.has(`${root}current/index.html`), false);
  assert.equal(objects.has(`${root}thumbnail.webp`), true);
  for (let day = 1; day <= 5; day++) {
    for (let i = 0; i < 5; i++) objects.set(`deployment-sources/2026-10-0${day}/${ids[0]}/${i}.zip`, 'source');
    objects.set(`deployment-sources/2026-10-0${day}/${ids[1]}/keep.zip`, 'other source');
  }
  await cleanAppStorage('storage-qa', ids[0], true, () => {});
  assert.equal([...objects.keys()].some(key => key.startsWith(root) || key.includes(`/${ids[0]}/`)), false);
  assert.equal(objects.get('apps/another/current/index.html'), 'other owner');
  assert.equal([...objects.keys()].filter(key => key.endsWith('/keep.zip')).length, 5);

  // A real publication is paused mid-upload. Deletion must wait for it, then remove it.
  const { DeploymentService } = await import('../server/src/modules/deployment/deployment.service');
  const { deployments } = await import('../server/src/modules/deployment/state');
  const service = new DeploymentService();
  const racingProject = randomUUID(); const racingDeployment = randomUUID();
  let entered!: () => void; let release!: () => void;
  const uploadEntered = new Promise<void>(resolve => { entered = resolve; });
  const uploadRelease = new Promise<void>(resolve => { release = resolve; });
  pauseUpload = async () => { entered(); await uploadRelease; };
  deployments.set(racingDeployment, {
    status: 'IDLE', logs: [], workDir: null,
    project: { id: racingProject, slug: 'race-qa', name: 'Race QA', repoUrl: 'html:qa', sourceType: 'html' as never,
      htmlContent: '<!doctype html><h1>Race QA</h1>', framework: 'Unknown', category: 'Other', tags: ['qa'],
      description: 'Storage deletion concurrency verification.', lastDeployed: '', status: 'Building', deployTarget: 'r2' },
  });
  const publication = service.runDeployment(racingDeployment);
  await Promise.race([uploadEntered, publication.then(() => { throw new Error('Publication did not enter its upload boundary.'); })]);
  const deletion = service.deleteProjectStorage(racingProject, 'race-qa');
  assert.equal(service.pendingCount(), 2);
  release();
  await Promise.all([publication, deletion]);
  pauseUpload = undefined;
  assert.equal([...objects.keys()].some(key => key.startsWith('apps/race-qa/')), false);
  assert.equal(service.pendingCount(), 0);
  objects.set('apps/race-qa/current/index.html', 'new project');
  await service.deleteProjectStorage(racingProject, 'race-qa');
  assert.equal(objects.get('apps/race-qa/current/index.html'), 'new project');

  const deleted: string[] = [];
  await deploymentSourceService.cleanup({ ASSETS: {
    list: async ({ cursor }: { cursor?: string }) => cursor
      ? { objects: [{ key: 'old-2', uploaded: new Date(0) }], truncated: false }
      : { objects: [{ key: 'old-1', uploaded: new Date(0) }, { key: 'fresh', uploaded: new Date() }], truncated: true, cursor: 'next' },
    delete: async (keys: string[]) => deleted.push(...keys),
  } } as never);
  assert.deepEqual(deleted, ['old-1', 'old-2']);

  // Run the real Node HTTP endpoint, then restart it with the same receipts.
  const projectId = randomUUID();
  const slug = 'delete-and-reuse';
  const appDirectory = path.join(directory, 'apps', slug);
  mkdirSync(appDirectory, { recursive: true });
  writeFileSync(path.join(appDirectory, 'index.html'), 'old app');
  const port = 4199;
  const base = `http://127.0.0.1:${port}/api/v1`;
  const token = 'local-storage-qa';
  const start = async () => {
    const child = spawn('./server/node_modules/.bin/tsx', ['server/src/index.ts'], {
      env: { ...process.env, DEPLOY_TARGET: 'local', SERVER_PORT: String(port), DEPLOY_SERVICE_TOKEN: token },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    child.stderr.on('data', () => {});
    for (let i = 0; i < 50; i++) {
      try { if ((await fetch(`http://127.0.0.1:${port}/healthz`)).ok) return child; } catch { /* startup */ }
      if (child.exitCode !== null) throw new Error('Local Node service exited before readiness.');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    child.kill(); throw new Error('Local Node service did not start.');
  };
  const stop = async (child: ReturnType<typeof spawn>) => { const exited = once(child, 'exit'); child.kill('SIGTERM'); await exited; };
  const post = (route: string, body: unknown) => fetch(`${base}${route}`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-gemigo-builder-token': token }, body: JSON.stringify(body),
  });
  let child = await start();
  try {
    assert.equal((await fetch(`${base}/projects/delete-storage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status, 401);
    assert.equal((await post('/projects/delete-storage', { projectId, slug })).status, 200);
    assert.equal(existsSync(appDirectory), false);
    const late = await post('/deploy', { id: projectId, slug, name: 'Old app', repoUrl: 'html:qa', sourceType: 'html', htmlContent: '<h1>Late</h1>' });
    assert.equal(late.status, 410);
    mkdirSync(appDirectory, { recursive: true });
    writeFileSync(path.join(appDirectory, 'index.html'), 'new owner');
    await stop(child); child = await start();
    assert.equal((await post('/projects/delete-storage', { projectId, slug })).status, 200);
    assert.equal(existsSync(path.join(appDirectory, 'index.html')), true, 'completed retry after restart never deletes a reused address');
    assert.equal((await post('/projects/delete-storage', { projectId, slug: 'wrong-address' })).status, 503);
  } finally { await stop(child); }
  console.log('PASS: paginated R2 deletion; explicit per-key failure; keep current/previous; sweep orphan releases and legacy current; project-scoped dated ZIP cleanup; ZIP expiration pagination; authenticated Node deletion; late publish rejected; persistent idempotence after slug reuse/restart.');
} finally { rmSync(directory, { recursive: true, force: true }); }
