import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';

const image = process.env.BUILD_TEST_IMAGE || 'deploy-your-app-server:latest';
const dir = mkdtempSync(path.join(tmpdir(), 'gemigo-sandbox-'));
const container = `gemigo-sandbox-qa-${randomUUID()}`;
const keepAlive = setInterval(() => {}, 1000);
const request = (url, init = {}) => fetch(url, { ...init, signal: AbortSignal.timeout(10000) });
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
    packageManager: JSON.parse(readFileSync('package.json', 'utf8')).packageManager,
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
  let base = `http://127.0.0.1:${port}`;
  for (let n = 0; n < 60; n++) {
    if (
      await request(`${base}/healthz`)
        .then((r) => r.ok)
        .catch(() => false)
    )
      break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert.equal((await request(`${base}/api/v1/deployments/${randomUUID()}`)).status, 401);
  const started = await request(`${base}/api/v1/deploy`, {
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
      await request(`${base}/api/v1/deployments/${deploymentId}`, {
        headers: { 'x-gemigo-builder-token': token },
      })
    ).json();
    if (receipt.status === 'SUCCESS' || receipt.status === 'FAILED') break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert.equal(receipt.status, 'SUCCESS', JSON.stringify(receipt));
  assert.equal(receipt.buildMode, 'build');
  assert.match(await (await request(`${base}/apps/isolation-qa/`)).text(), /Isolated build passed/);
  assert.equal(
    docker('ps', '-a', '--filter', `name=gemigo-build-${deploymentId}`, '--format', '{{.Names}}'),
    ''
  );
  assert.equal(
    (
      await request(`${base}/api/v1/maintenance/drain`, {
        method: 'POST',
        headers: { 'x-gemigo-builder-token': token },
      })
    ).status,
    200
  );
  assert.equal(
    (
      await request(`${base}/api/v1/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-gemigo-builder-token': token },
        body: JSON.stringify({
          id: randomUUID(),
          name: 'Rejected during drain',
          slug: 'drain-qa',
          repoUrl: 'qa.zip',
        }),
      })
    ).status,
    429
  );
  docker('restart', container);
  base = `http://127.0.0.1:${docker('port', container, '4173/tcp').split(':').at(-1)}`;
  for (let n = 0; n < 30; n++) {
    if (
      await request(`${base}/healthz`)
        .then((r) => r.ok)
        .catch(() => false)
    )
      break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert.equal(
    (
      await (
        await request(`${base}/api/v1/deployments/${deploymentId}`, {
          headers: { 'x-gemigo-builder-token': token },
        })
      ).json()
    ).status,
    'SUCCESS'
  );
  // Exercise the same release entry used in production, including rollback on startup failure.
  const archive = path.join(dir, 'image.tar.gz');
  const save = spawn('docker', ['save', image]);
  const exited = new Promise((resolve, reject) => {
    save.on('error', reject);
    save.on('close', (code) => (code === 0 ? resolve() : reject(new Error('Image export failed'))));
  });
  await pipeline(save.stdout, createGzip(), createWriteStream(archive));
  await exited;
  const releaseEnv = {
    ...process.env,
    DEPLOY_CONTAINER_NAME: container,
    DEPLOY_DATA_DIR: dir,
    PORT: '14173',
    DEPLOY_SERVICE_TOKEN: token,
    STORAGE_TYPE: 'file',
    DEPLOY_TARGET: 'local',
  };
  execFileSync('bash', ['scripts/deploy.sh', archive], { env: releaseEnv, stdio: 'pipe' });
  base = 'http://127.0.0.1:14173';
  assert.equal((await request(`${base}/healthz`)).status, 200);
  const beforeRollback = docker('inspect', container, '--format', '{{.Id}}');
  assert.throws(() =>
    execFileSync('bash', ['scripts/deploy.sh', archive], {
      env: { ...releaseEnv, PORT: 'invalid-port' },
      stdio: 'pipe',
    })
  );
  assert.equal(
    docker('inspect', container, '--format', '{{.Id}}'),
    beforeRollback,
    'restore the same previously healthy container'
  );
  assert.match(await (await request(`${base}/apps/isolation-qa/`)).text(), /Isolated build passed/);
  console.log(
    'PASS: production image builds in a non-root isolated container without controller secrets, storage or Docker socket; read-only root; cleanup and receipt survive restart'
  );
} finally {
  try {
    docker(
      'run',
      '--rm',
      '--entrypoint',
      'node',
      '-v',
      `${dir}:/data`,
      image,
      '-e',
      "const fs=require('fs'); for(const n of fs.readdirSync('/data')) fs.rmSync('/data/'+n,{recursive:true,force:true});"
    );
    docker('rm', '-f', container);
  } catch {
    /* absent */
  }
  rmSync(dir, { recursive: true, force: true });
  clearInterval(keepAlive);
}
