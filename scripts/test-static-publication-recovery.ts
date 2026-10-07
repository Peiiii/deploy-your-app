import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { authRepository } from '../workers/api/src/repositories/auth.repository.ts';
import { projectRepository } from '../workers/api/src/repositories/project.repository.ts';
import { SourceType } from '../workers/api/src/types/project.ts';

const require = createRequire(import.meta.url);
const runtime = createRequire(require.resolve('wrangler/package.json'));
const { Miniflare } = runtime('miniflare'), { build } = runtime('esbuild');
const AdmZip = createRequire(require.resolve('../server/package.json'))('adm-zip');
// Fault injection lives only in this test bundle, never in the production API.
const bundle = await build({ stdin: { resolveDir: process.cwd(), contents: `
  import worker, {AppGateway as BaseGateway} from './workers/api/src/index.ts';
  export class AppGateway extends BaseGateway {
    constructor(state, env) {
      const bucket = env.ASSETS;
      env.ASSETS = new Proxy(bucket, {get(target, name) {
        const member = Reflect.get(target, name);
        if (typeof member !== 'function') return member;
        return async (...args) => {
          if (name === 'put' && args[0].endsWith('/deployment.json') && await env.FAULTS.get('pointer')) {
            await env.FAULTS.delete('pointer'); await member.apply(target,args);
            throw new Error('Response lost after pointer write');
          }
          return member.apply(target,args);
        };
      }});
      const database = env.PROJECTS_DB;
      env.PROJECTS_DB = new Proxy(database, {get(target, name) {
        if (name !== 'prepare') { const member = Reflect.get(target,name); return typeof member === 'function' ? member.bind(target) : member; }
        return sql => {
          const wrap = statement => new Proxy(statement, {get(target,name) {
            const member = Reflect.get(target,name);
            if (name === 'bind') return (...args) => wrap(member.apply(target,args));
            if (name === 'run') return async (...args) => {
              if (sql.includes('SET status = ?, finished_at') && await env.FAULTS.get('finish')) {
                await env.FAULTS.delete('finish'); throw new Error('Completion database temporarily unavailable');
              }
              return member.apply(target,args);
            };
            return typeof member === 'function' ? member.bind(target) : member;
          }});
          return wrap(target.prepare(sql));
        };
      }});
      super(state, env); this.testState = state; this.testEnv = env;
    }
    async alarm() { if (!await this.testEnv.FAULTS.get('pause')) await super.alarm(); }
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === '/run') { await super.alarm(); return new Response('ok'); }
      if (path === '/jobs') return Response.json([...await this.testState.storage.list({prefix:'publication:'})], {headers:{'x-alarm':String(await this.testState.storage.getAlarm())}});
      return super.fetch(request);
    }
  }
  export default worker;
` }, bundle: true, write: false, format: 'esm', platform: 'browser' });
const options = {
  modules: [{ type: 'ESModule', path: 'static-recovery-test.js', contents: bundle.outputFiles[0].text }],
  d1Databases: { PROJECTS_DB: 'recovery' }, r2Buckets: ['ASSETS'], kvNamespaces: ['FAULTS'],
  durableObjects: { APP_GATEWAY: { className: 'AppGateway', useSQLite: true } },
  bindings: { DEPLOY_TARGET: 'r2', APPS_ROOT_DOMAIN: 'gemigo.app' }, compatibilityDate: '2026-09-18',
  outboundService: async () => { throw new Error('No builder or other external service is allowed'); },
};
const mf = new Miniflare(options);
try {
  let db = await mf.getD1Database('PROJECTS_DB'), bucket = await mf.getR2Bucket('ASSETS'), faults = await mf.getKVNamespace('FAULTS');
  await db.exec(readFileSync('workers/api/migrations/0007_app_api_gateway.sql', 'utf8').replace(/\n/g, ' '));
  const user = await authRepository.createUser(db, { id: crypto.randomUUID() }), session = await authRepository.createSession(db, user.id);
  const call = (path: string, init: RequestInit) => mf.dispatchFetch(`https://gemigo.test/api/v1${path}`, { ...init, headers: { Cookie: `session_id=${session.id}`, ...init.headers } });
  const parse = async (response: Response) => { const text = await response.text(); assert.ok(response.ok, text); return JSON.parse(text); };
  const project = await projectRepository.createProjectRecord(db, { id: crypto.randomUUID(), ownerId: user.id, name: 'Recovery', slug: 'recovery-qa', repoUrl: 'qa.zip', sourceType: SourceType.Zip, lastDeployed: '', status: 'Offline', framework: 'Unknown', description: 'Ready metadata', category: 'Other', tags: ['qa'], isPublic: false });
  const stub = async () => { const namespace = await mf.getDurableObjectNamespace('APP_GATEWAY'); return namespace.get(namespace.idFromName(project.id)); };
  const run = async () => assert.equal((await (await stub()).fetch('https://test/run')).status, 200);
  const jobs = async () => (await (await stub()).fetch('https://test/jobs')).json();
  const status = async (id: string) => parse(await call(`/deployments/${id}/reconcile`, { method: 'POST' }));
  const submit = async (archive: Buffer) => {
    const source = await parse(await call(`/projects/${project.id}/deployment-source`, { method: 'PUT', headers: { 'Content-Type': 'application/zip', 'Content-Length': String(archive.length) }, body: archive }));
    const job = await parse(await call('/deploy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: project.id, zipSourceKey: source.zipSourceKey }) }));
    return { ...source, ...job };
  };
  const finish = async (id: string, expected = 'SUCCESS', manual = true) => {
    for (let i = 0; i < 1000; i++) {
      const result = await status(id);
      if (['SUCCESS', 'FAILED'].includes(result.status)) { assert.equal(result.status, expected, JSON.stringify(result)); return result; }
      if (manual) await run();
      else await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('Job did not finish');
  };
  const make = (files: Record<string, Buffer | string>) => { const archive = new AdmZip(); for (const [name, value] of Object.entries(files)) archive.addFile(name, Buffer.from(value)); return archive.toBuffer(); };
  const pointer = () => bucket.get('apps/recovery-qa/deployment.json').then((object: R2ObjectBody) => object.json<{ prefix: string }>());

  await faults.put('pause', 'true');
  const assets = Object.fromEntries(Array.from({ length: 55 }, (_, i) => [`assets/${i}.txt`, `asset-${i}`]));
  const queued = await submit(make({ 'index.html': '<title>Recovered</title>', ...assets }));
  await run(); await run();
  assert.equal((await jobs())[0][1].done, 20);
  await mf.setOptions(options); // Actual workerd restart, retained R2/D1/DO storage.
  db = await mf.getD1Database('PROJECTS_DB'); bucket = await mf.getR2Bucket('ASSETS'); faults = await mf.getKVNamespace('FAULTS');
  assert.equal((await jobs())[0][1].done, 20);
  await faults.delete('pause');
  // The test pause consumes an alarm. Exercise the same recovery call used by cron.
  assert.equal((await (await stub()).fetch('https://test/recover-publication', { headers: { 'x-project-id': project.id } })).status, 200);
  await finish(queued.deploymentId, 'SUCCESS', false);
  await faults.put('pause', 'true');
  assert.equal(await (await bucket.get(`${(await pointer()).prefix}/assets/54.txt`)).text(), 'asset-54');
  console.log('PASS workerd restart / persisted cursor / no browser connection');

  await faults.put('pointer', 'after');
  const lost = await submit(make({ 'index.html': '<title>Lost response</title>' }));
  await finish(lost.deploymentId);
  assert.equal(await (await bucket.get(`${(await pointer()).prefix}/index.html`)).text(), '<title>Lost response</title>');
  assert.equal((await jobs()).length, 0);
  console.log('PASS ambiguous pointer write keeps activated release / resumes SUCCESS');

  const deferred = await submit(make({ 'index.html': '<title>Deferred completion</title>' }));
  await run(); await run(); await run();
  await faults.put('finish', 'fail once');
  await run();
  assert.equal((await status(deferred.deploymentId)).status, 'BUILDING');
  assert.equal(await (await bucket.get(`${(await pointer()).prefix}/index.html`)).text(), '<title>Deferred completion</title>');
  await finish(deferred.deploymentId);
  console.log('PASS D1 completion failure preserves activated site / persists SUCCESS on retry');

  const original = (await pointer()).prefix;
  const changed = await submit(make({ 'index.html': '<title>Changed source</title>' }));
  await run();
  await bucket.put(changed.zipSourceKey, new Uint8Array(make({ 'index.html': '<title>Unexpected source</title>' })));
  await finish(changed.deploymentId, 'FAILED');
  assert.equal((await pointer()).prefix, original);
  console.log('PASS changed ZIP cannot replace verified source / old site preserved');

  const crc = make({ 'index.html': '<title>CRC</title>', 'file.bin': Buffer.alloc(512, 7) });
  const central = crc.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  crc.writeUInt32LE((crc.readUInt32LE(central + 16) ^ 1) >>> 0, central + 16);
  await finish((await submit(crc)).deploymentId, 'FAILED');
  assert.equal((await pointer()).prefix, original);
  const unsafe = make({ 'index.html': '<title>Unsafe</title>', 'xx/file': 'x' });
  for (let offset = unsafe.indexOf(Buffer.from('xx/file')); offset !== -1; offset = unsafe.indexOf(Buffer.from('xx/file'), offset + 1)) unsafe.write('../file', offset);
  await finish((await submit(unsafe)).deploymentId, 'FAILED');
  assert.equal((await pointer()).prefix, original);
  console.log('PASS CRC / unsafe path / failed publish keeps current release');

  const random = randomBytes(74 * 1024 * 1024);
  const largeZip = make({ 'index.html': '<title>Large</title>', 'large.bin': random });
  assert.ok(largeZip.length < 75 * 1024 * 1024 && largeZip.length > 74 * 1024 * 1024);
  const started = Date.now();
  await finish((await submit(largeZip)).deploymentId);
  assert.equal(createHash('sha256').update(Buffer.from(await (await bucket.get(`${(await pointer()).prefix}/large.bin`)).arrayBuffer())).digest('hex'), createHash('sha256').update(random).digest('hex'));
  console.log(`PASS near-75MiB upload / 74MiB binary SHA preserved / ${Date.now() - started}ms`);
  const expanded = Buffer.alloc(160 * 1024 * 1024, 19);
  const compressed = make({ 'index.html': '<title>Streaming</title>', 'large.bin': expanded });
  const expandedStart = Date.now();
  await finish((await submit(compressed)).deploymentId);
  assert.equal((await bucket.head(`${(await pointer()).prefix}/large.bin`)).size, expanded.length);
  assert.equal(createHash('sha256').update(Buffer.from(await (await bucket.get(`${(await pointer()).prefix}/large.bin`)).arrayBuffer())).digest('hex'), createHash('sha256').update(expanded).digest('hex'));
  console.log(`PASS 160MiB expanded single file / Worker streaming / SHA preserved / ${Date.now() - expandedStart}ms`);

  const oversized = make({ 'index.html': '<title>Limit</title>' });
  const offset = oversized.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  oversized.writeUInt32LE(501 * 1024 * 1024, offset + 24);
  assert.equal((await finish((await submit(oversized)).deploymentId, 'FAILED')).errorCode, 'archive_too_large');
  const tooMany = make(Object.fromEntries(Array.from({ length: 10001 }, (_, i) => [i ? `${i}.txt` : 'index.html', 'x'])));
  assert.equal((await finish((await submit(tooMany)).deploymentId, 'FAILED')).errorCode, 'archive_too_large');
  console.log('PASS original 500MiB / 10,000 entry limits enforced');
  for (let i = 0; i < 1105; i += 50) await Promise.all(Array.from({ length: Math.min(50, 1105 - i) }, (_, n) => bucket.put(`apps/recovery-qa/orphan/${i + n}.txt`, 'x')));
  await bucket.put('apps/unrelated-qa/index.html', 'keep unrelated');
  const pending = await submit(make({ 'index.html': '<title>Cancelled</title>' }));
  assert.equal((await call(`/projects/${project.id}`, { method: 'DELETE' })).status, 204);
  assert.equal((await jobs()).length, 0);
  assert.equal((await db.prepare('SELECT status FROM deployment_attempts WHERE id = ?').bind(pending.deploymentId).first<{status: string}>()).status, 'failed');
  assert.equal((await call(`/deployments/${pending.deploymentId}/reconcile`, { method: 'POST' })).status, 401);
  assert.equal((await bucket.list({ prefix: 'apps/recovery-qa/' })).objects.length, 0);
  assert.equal(await (await bucket.get('apps/unrelated-qa/index.html')).text(), 'keep unrelated');
  console.log('PASS deletion cancels queued publication and removes all R2 releases');
} finally { await mf.dispose(); }
