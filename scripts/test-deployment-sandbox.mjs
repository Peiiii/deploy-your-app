import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const image = process.env.BUILD_TEST_IMAGE || 'deploy-your-app-server:latest';
const dir = mkdtempSync(path.join(tmpdir(), 'gemigo-sandbox-'));
const container = `gemigo-sandbox-qa-${randomUUID()}`;
const token = 'qa-internal-token';
const sentinel = 'qa-controller-secret-does-not-belong-in-builds';
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8' }).trim();
const buildScript = `const fs = require('fs');
if (process.getuid() === 0) throw Error('Build must not run as root');
if (process.env.R2_SECRET_ACCESS_KEY || process.env.DEPLOY_SERVICE_TOKEN || process.env.DASHSCOPE_API_KEY) throw Error('Controller credentials leaked');
if (fs.readFileSync('/proc/1/environ', 'utf8').includes('${sentinel}')) throw Error('Controller process is visible');
if (fs.existsSync('/var/run/docker.sock') || fs.existsSync('/data/controller-secret')) throw Error('Controller storage is visible');
try { fs.writeFileSync('/app/escape.txt', 'bad'); throw Error('Root filesystem is writable'); } catch(e) { if(e.code !== 'EROFS' && e.code !== 'EACCES') throw e; }
fs.mkdirSync('dist'); fs.writeFileSync('dist/index.html', '<h1>Isolated build passed</h1>');`;
const files = {
  'package.json': JSON.stringify({
    name: 'isolated-qa',
    version: '1.0.0',
    scripts: { build: 'node build.cjs' },
  }),
  'build.cjs': buildScript,
};
try {
  execFileSync(
    'python3',
    [
      '-c',
      "import zipfile,json,sys; z=zipfile.ZipFile(sys.argv[1],'w'); [z.writestr(k,v) for k,v in json.load(sys.stdin).items()]; z.close()",
      path.join(dir, 'fixture.zip'),
    ],
    { input: JSON.stringify(files) }
  );
  writeFileSync(path.join(dir, 'controller-secret'), sentinel);
  const imageId = docker('image', 'inspect', image, '--format', '{{.Id}}');
  docker(
    'run',
    '-d',
    '--name',
    container,
    '-p',
    '127.0.0.1::4173',
    '-v',
    `${dir}:/data`,
    '-v',
    '/var/run/docker.sock:/var/run/docker.sock',
    '-e',
    'NODE_ENV=production',
    '-e',
    'STORAGE_TYPE=file',
    '-e',
    'DEPLOY_TARGET=local',
    '-e',
    `DEPLOY_SERVICE_TOKEN=${token}`,
    '-e',
    `BUILD_SANDBOX_IMAGE=${imageId}`,
    '-e',
    `BUILD_HOST_DATA_DIR=${dir}`,
    '-e',
    `R2_SECRET_ACCESS_KEY=${sentinel}`,
    imageId
  );
  const port = docker('port', container, '4173/tcp').split(':').at(-1);
  const base = `http://127.0.0.1:${port}`;
  for (let n = 0; n < 60; n++) {
    if (
      await fetch(`${base}/healthz`)
        .then((r) => r.ok)
        .catch(() => false)
    )
      break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert.equal((await fetch(`${base}/api/v1/deployments/${randomUUID()}`)).status, 401);
  const started = await fetch(`${base}/api/v1/deploy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-gemigo-builder-token': token },
    body: JSON.stringify({
      id: randomUUID(),
      name: 'Isolation QA',
      slug: 'isolation-qa',
      description: 'QA',
      category: 'Tools',
      tags: ['qa'],
      sourceType: 'zip',
      repoUrl: 'fixture.zip',
      zipData: readFileSync(path.join(dir, 'fixture.zip')).toString('base64'),
    }),
  });
  assert.equal(started.status, 200);
  const { deploymentId } = await started.json();
  let receipt;
  for (let n = 0; n < 180; n++) {
    receipt = await (
      await fetch(`${base}/api/v1/deployments/${deploymentId}`, {
        headers: { 'x-gemigo-builder-token': token },
      })
    ).json();
    if (receipt.status === 'SUCCESS' || receipt.status === 'FAILED') break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert.equal(receipt.status, 'SUCCESS', JSON.stringify(receipt));
  assert.equal(receipt.buildMode, 'build');
  assert.match(await (await fetch(`${base}/apps/isolation-qa/`)).text(), /Isolated build passed/);
  assert.equal(
    docker('ps', '-a', '--filter', `name=gemigo-build-${deploymentId}`, '--format', '{{.Names}}'),
    ''
  );
  docker('restart', container);
  for (let n = 0; n < 30; n++) {
    if (
      await fetch(`${base}/healthz`)
        .then((r) => r.ok)
        .catch(() => false)
    )
      break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert.equal(
    (
      await (
        await fetch(`${base}/api/v1/deployments/${deploymentId}`, {
          headers: { 'x-gemigo-builder-token': token },
        })
      ).json()
    ).status,
    'SUCCESS'
  );
  console.log(
    'PASS: production image builds in a non-root isolated container without controller secrets, storage or Docker socket; read-only root; cleanup and receipt survive restart'
  );
} finally {
  try {
    docker('rm', '-f', container);
  } catch {
    /* absent */
  }
  rmSync(dir, { recursive: true, force: true });
}
