import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, randomBytes } from 'node:crypto';

const root = await mkdtemp(path.join(tmpdir(), 'gemigo-deploy-runtime-'));
process.env.DATA_DIR = root;
process.env.STORAGE_TYPE = 'file';
process.env.DEPLOY_TARGET = 'local';
process.env.R2_ACCOUNT_ID = 'test';
process.env.R2_BUCKET_NAME = 'test';
process.env.R2_ACCESS_KEY_ID = 'test';
process.env.R2_SECRET_ACCESS_KEY = 'test';
process.env.APPS_ROOT_DOMAIN = 'gemigo.app';
const serverRequire = createRequire(path.resolve('server/package.json'));
const AdmZip = serverRequire('adm-zip');
const { S3Client } = serverRequire('@aws-sdk/client-s3');
const { deployments } = await import('../server/src/modules/deployment/state.ts');
const { deploymentService } =
  await import('../server/src/modules/deployment/deployment.service.ts');
const { readDeploymentReceipt, saveDeploymentReceipt, recoverDeploymentReceipts } =
  await import('../server/src/modules/deployment/deploymentReceipt.ts');
const { SourceType } = await import('../server/src/common/types.ts');
const { deployToR2 } = await import('../server/src/modules/deployment/providers/r2Provider.ts');
const gateway = (await import('../workers/r2-gateway/worker.ts')).default;
const zip = new AdmZip();
zip.addFile('website/index.html', Buffer.from('<h1>Large static ZIP works</h1>'));
zip.addFile('website/asset.bin', randomBytes(12 * 1024 * 1024));
zip.addFile('__MACOSX/._website', Buffer.from('metadata'));
const zipBytes: Buffer = zip.toBuffer();
assert.ok(zipBytes.length > 10 * 1024 * 1024);
const objects = new Map<string, Buffer>();
let consumedSource = false;
let failUpload = false;
let failPointer = false;
let lostPointerResponse = false;
const previousSend = S3Client.prototype.send;
Object.assign(S3Client.prototype, {
  send: async (command: {
    constructor: { name: string };
    input: {
      Key?: string;
      Body?: Buffer | string | Readable;
      Prefix?: string;
      Delete?: { Objects: { Key: string }[] };
    };
  }) => {
    const { Key = '', Body, Prefix, Delete } = command.input;
    switch (command.constructor.name) {
      case 'GetObjectCommand':
        if (Key.startsWith('deployment-sources/'))
          return {
            ContentLength: zipBytes.length,
            Body: { transformToByteArray: async () => zipBytes },
          };
        if (!objects.has(Key)) throw Object.assign(new Error('missing'), { name: 'NoSuchKey' });
        return { Body: { transformToString: async () => objects.get(Key)!.toString() } };
      case 'DeleteObjectCommand':
        consumedSource = true;
        return {};
      case 'PutObjectCommand': {
        let bytes: Buffer;
        if (Body instanceof Readable) {
          const chunks: Buffer[] = [];
          for await (const chunk of Body) chunks.push(Buffer.from(chunk));
          bytes = Buffer.concat(chunks);
        } else bytes = Buffer.from(Body ?? '');
        if (failUpload && Key.endsWith('test.js')) throw new Error('simulated upload failure');
        if (failPointer && Key.endsWith('/deployment.json'))
          throw new Error('simulated pointer failure');
        objects.set(Key, bytes);
        if (lostPointerResponse && Key.endsWith('/deployment.json'))
          throw new Error('response lost after writing pointer');
        return {};
      }
      case 'ListObjectsV2Command':
        return {
          Contents: [...objects.keys()]
            .filter((key) => key.startsWith(Prefix!))
            .map((Key) => ({ Key })),
        };
      case 'DeleteObjectsCommand':
        for (const entry of Delete!.Objects) objects.delete(entry.Key);
        return {};
      default:
        throw new Error(command.constructor.name);
    }
  },
});
const originalFetch = globalThis.fetch;
try {
  const id = randomUUID();
  const project = {
    id: randomUUID(),
    name: 'QA',
    repoUrl: 'test.zip',
    sourceType: SourceType.Zip,
    slug: 'large-zip',
    status: 'Building' as const,
    lastDeployed: '',
    framework: 'Unknown' as const,
    description: 'Ready metadata',
    category: 'Other',
    tags: ['qa'],
  };
  deployments.set(id, {
    status: 'IDLE',
    logs: [],
    project,
    workDir: null,
    zipSourceKey: `deployment-sources/2026-10-02/${project.id}/${randomUUID()}.zip`,
  });
  await deploymentService.runDeployment(id);
  assert.equal(readDeploymentReceipt(id)?.status, 'SUCCESS');
  assert.equal(readDeploymentReceipt(id)?.buildMode, 'static');
  assert.equal(consumedSource, true);
  assert.match(
    await readFile(path.join(root, 'apps/large-zip/index.html'), 'utf8'),
    /Large static ZIP works/
  );
  assert.equal(
    await access(path.join(root, 'builds', id))
      .then(() => true)
      .catch(() => false),
    false
  );
  assert.equal(deployments.has(id), false, 'release payloads from memory after completion');

  const badZip = new AdmZip();
  badZip.addFile('readme.txt', Buffer.from('no HTML'));
  const badId = randomUUID();
  deployments.set(badId, {
    status: 'IDLE',
    logs: [],
    project: { ...project, slug: 'bad-zip' },
    workDir: null,
    zipData: badZip.toBuffer().toString('base64'),
  });
  await deploymentService.runDeployment(badId);
  assert.equal(readDeploymentReceipt(badId)?.errorCode, 'missing_entry');
  assert.equal(readDeploymentReceipt(badId)?.status, 'FAILED');

  const sourceZip = new AdmZip();
  sourceZip.addFile(
    'index.html',
    Buffer.from('<script type="module" src="/src/main.tsx"></script>')
  );
  const sourceId = randomUUID();
  deployments.set(sourceId, {
    status: 'IDLE',
    logs: [],
    project,
    workDir: null,
    zipData: sourceZip.toBuffer().toString('base64'),
  });
  await deploymentService.runDeployment(sourceId);
  assert.equal(readDeploymentReceipt(sourceId)?.errorCode, 'missing_build_script');

  const githubZip = new AdmZip();
  githubZip.addFile('repo-release/index.html', Buffer.from('<h1>Custom default branch</h1>'));
  let usedDefaultBranch = false;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.startsWith('https://api.github.com/repos/'))
      return Response.json({ default_branch: 'release' });
    assert.ok(url.endsWith('/refs/heads/release'));
    usedDefaultBranch = true;
    return new Response(new Uint8Array(githubZip.toBuffer()));
  };
  const githubId = randomUUID();
  deployments.set(githubId, {
    status: 'IDLE',
    logs: [],
    project: {
      ...project,
      repoUrl: 'github.com/fixture/repo',
      sourceType: SourceType.GitHub,
      slug: 'github-qa',
    },
    workDir: null,
  });
  await deploymentService.runDeployment(githubId);
  assert.equal(readDeploymentReceipt(githubId)?.status, 'SUCCESS');
  assert.equal(usedDefaultBranch, true);
  globalThis.fetch = async () => new Response('', { status: 404 });
  const privateId = randomUUID();
  deployments.set(privateId, {
    status: 'IDLE',
    logs: [],
    project: {
      ...project,
      repoUrl: 'https://github.com/fixture/private',
      sourceType: SourceType.GitHub,
    },
    workDir: null,
  });
  await deploymentService.runDeployment(privateId);
  assert.equal(readDeploymentReceipt(privateId)?.errorCode, 'repository_unavailable');

  const interruptedId = randomUUID();
  saveDeploymentReceipt(interruptedId, {
    status: 'BUILDING',
    stage: 'install',
    logs: [],
    project: { ...project, htmlContent: 'MUST_NOT_PERSIST' },
    workDir: null,
  });
  recoverDeploymentReceipts();
  assert.equal(readDeploymentReceipt(interruptedId)?.errorCode, 'server_restarted');
  assert.equal(
    JSON.stringify(readDeploymentReceipt(interruptedId)).includes('MUST_NOT_PERSIST'),
    false
  );
  assert.equal(readDeploymentReceipt(id)?.projectMetadata?.url, '/apps/large-zip/');

  const distPath = path.join(root, 'fixture');
  await mkdir(distPath);
  await writeFile(path.join(distPath, 'index.html'), '<h1>New version</h1>');
  await writeFile(path.join(distPath, 'test.js'), 'console.log("new")');
  await writeFile(path.join(distPath, '.env'), 'FAKE_KEY=must-not-publish');
  await mkdir(path.join(distPath, 'nested'));
  await writeFile(path.join(distPath, 'nested', '.env.local'), 'FAKE_KEY=must-not-publish');
  await mkdir(path.join(distPath, '.well-known'));
  await writeFile(path.join(distPath, '.well-known', 'test.txt'), 'public asset');
  const active = 'apps/site/current';
  objects.set(`${active}/index.html`, Buffer.from('<h1>Old version</h1>'));
  objects.set(`${active}/old.js`, Buffer.from('old asset'));
  failUpload = true;
  await assert.rejects(
    deployToR2({ slug: 'site', distPath, deploymentId: randomUUID(), log: () => {} }),
    /upload failure/
  );
  assert.match(objects.get(`${active}/index.html`)!.toString(), /Old version/);
  assert.equal(objects.has('apps/site/deployment.json'), false);
  failUpload = false;
  failPointer = true;
  await assert.rejects(
    deployToR2({ slug: 'site', distPath, deploymentId: randomUUID(), log: () => {} }),
    /pointer failure/
  );
  assert.equal(objects.has('apps/site/deployment.json'), false);
  failPointer = false;
  await deployToR2({ slug: 'site', distPath, deploymentId: randomUUID(), log: () => {} });
  lostPointerResponse = true;
  const recoveredId = randomUUID();
  await deployToR2({ slug: 'site', distPath, deploymentId: recoveredId, log: () => {} });
  assert.equal(
    objects.has(`apps/site/releases/${recoveredId}/index.html`),
    true,
    'never delete the newly active version after a lost response'
  );
  lostPointerResponse = false;
  const manifest = JSON.parse(objects.get('apps/site/deployment.json')!.toString());
  assert.equal(objects.has(`${manifest.prefix}/.env`), false);
  assert.equal(objects.has(`${manifest.prefix}/nested/.env.local`), false);
  assert.equal(objects.has(`${manifest.prefix}/.well-known/test.txt`), true);
  assert.ok(manifest.previousPrefix.startsWith('apps/site/releases/'));
  objects.set(`${manifest.previousPrefix}/old.js`, Buffer.from('old asset'));
  const bucket = {
    get: async (key: string) =>
      objects.has(key)
        ? {
            body: new ReadableStream({
              start(controller) {
                controller.enqueue(objects.get(key));
                controller.close();
              },
            }),
            httpMetadata: { contentType: 'text/html' },
          }
        : null,
  };
  const env = { ASSETS: bucket, APPS_ROOT_DOMAIN: 'gemigo.app' } as Parameters<
    typeof gateway.fetch
  >[1];
  const ctx = { waitUntil() {} } as ExecutionContext;
  objects.set(`${manifest.previousPrefix}/.env`, Buffer.from('FAKE_OLD_KEY=private'));
  for (const privatePath of ['/.env', '/%2eenv', '/nested/.env.local', '/.npmrc', '/.git/config']) {
    assert.equal((await gateway.fetch(new Request(`https://site.gemigo.app${privatePath}`), env, ctx)).status, 404);
  }
  assert.match(
    await (await gateway.fetch(new Request('https://site.gemigo.app/'), env, ctx)).text(),
    /New version/
  );
  assert.equal(
    await (await gateway.fetch(new Request('https://site.gemigo.app/old.js'), env, ctx)).text(),
    'old asset'
  );
  objects.delete('apps/site/deployment.json');
  assert.match(
    await (await gateway.fetch(new Request('https://site.gemigo.app/'), env, ctx)).text(),
    /Old version/
  );
  console.log(
    'PASS: large ZIP + macOS wrapper, missing entry, GitHub default branch/private failure, restart receipt, payload cleanup, atomic publication and new/legacy gateway'
  );
} finally {
  globalThis.fetch = originalFetch;
  S3Client.prototype.send = previousSend;
  await rm(root, { recursive: true, force: true });
}
