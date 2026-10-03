import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { GatewayRepository } from '../workers/api/src/app-gateway/repository';
import { parseConnection, upstreamUrl, publicAddress } from '../workers/api/src/app-gateway/config';
import { limitedText } from '../workers/api/src/app-gateway/body';
import { protectedStream } from '../workers/api/src/app-gateway/stream';
import { encryptSecret, decryptSecret } from '../workers/api/src/app-gateway/vault';

const sqlite = new DatabaseSync(':memory:');
sqlite.exec(
  readFileSync(
    new URL('../workers/api/migrations/0007_app_api_gateway.sql', import.meta.url),
    'utf8'
  )
);
class Statement {
  private values: (string | number | null)[] = [];
  constructor(private sql: string) {}
  bind(...values: (string | number | null)[]) {
    this.values = values;
    return this;
  }
  async first() {
    return sqlite.prepare(this.sql).get(...this.values) || null;
  }
  async all() {
    return { results: sqlite.prepare(this.sql).all(...this.values) };
  }
  async run() {
    return sqlite.prepare(this.sql).run(...this.values);
  }
}
const db = {
  prepare: (sql: string) => new Statement(sql),
  batch: async (statements: Statement[]) => {
    sqlite.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      sqlite.exec('COMMIT');
      return results;
    } catch (e) {
      sqlite.exec('ROLLBACK');
      throw e;
    }
  },
} as unknown as D1Database;
const keys = JSON.stringify({ active: 'v1', keys: { v1: btoa('x'.repeat(32)) } });
const a = new GatewayRepository(db, 'project-a');
const b = new GatewayRepository(db, 'project-b');
let checks = 0;
const check = (name: string) => {
  checks++;
  console.log(`PASS ${name}`);
};
const encrypted = await encryptSecret(keys, 'project-a', 'MODEL_KEY', 1, 'test-upstream-secret');
assert(!encrypted.ciphertext.includes('test-upstream-secret'));
assert.equal(
  await decryptSecret(keys, 'project-a', 'MODEL_KEY', 1, encrypted),
  'test-upstream-secret'
);
await assert.rejects(decryptSecret(keys, 'project-b', 'MODEL_KEY', 1, encrypted));
await assert.rejects(decryptSecret(keys, 'project-a', 'MODEL_KEY', 2, encrypted));
check('ciphertext is bound to project, name and version');
const rotatedRing = JSON.stringify({
  active: 'v2',
  keys: { v1: btoa('x'.repeat(32)), v2: btoa('y'.repeat(32)) },
});
assert.equal(
  await decryptSecret(rotatedRing, 'project-a', 'MODEL_KEY', 1, encrypted),
  'test-upstream-secret'
);
check('key ring supports reading old ciphertext after master rotation');
await a.saveSecret('MODEL_KEY', encrypted, 1);
assert.equal(await b.secret('MODEL_KEY'), null);
assert(!JSON.stringify(await a.list()).includes('test-upstream-secret'));
check('tenant isolation and metadata-only Secret listing');
await assert.rejects(a.saveSecret('MODEL_KEY', encrypted, 1));
check('Secret version compare-and-swap rejects stale writes');
for (const url of [
  'http://example.com',
  'https://localhost',
  'https://127.0.0.1',
  'https://0x7f000001',
  'https://[::1]',
  'https://foo.internal',
  'https://user:pass@example.com',
  'https://example.com:8080',
  'https://example.com/#x',
  'https://example.com/?key=x',
])
  assert.throws(() => upstreamUrl(url));
assert.equal(
  upstreamUrl('wss://dashscope.aliyuncs.com/api-ws/v1/realtime'),
  'https://dashscope.aliyuncs.com/api-ws/v1/realtime'
);
for (const ip of [
  '127.0.0.1',
  '10.0.0.1',
  '169.254.169.254',
  '172.16.0.1',
  '192.168.0.1',
  '100.64.0.1',
  '198.18.0.1',
  '::1',
  'fc00::1',
  '::ffff:127.0.0.1',
  '2001:db8::1',
  '2002:7f00:1::',
])
  assert.equal(publicAddress(ip), false, ip);
assert(publicAddress('8.8.8.8'));
assert(publicAddress('2606:4700:4700::1111'));
check('URL normalization and public address rules reject internal targets');
const config = parseConnection('chat', {
  protocol: 'openai-chat',
  baseUrl: 'https://api.openai.com/v1',
  secretName: 'MODEL_KEY',
  enabled: true,
  access: 'login',
  models: ['model-1'],
  limits: { concurrency: 2, userConcurrency: 1, appDaily: 4, userDaily: 3 },
});
assert.throws(() => parseConnection('chat', { ...config, authHeader: 'Host' }));
assert.throws(() => parseConnection('chat', { ...config, authPrefix: 'Bearer\r\n' }));
assert.throws(() =>
  parseConnection('chat', { ...config, models: [], protocol: 'openai-realtime' })
);
check('protocol declaration, credential headers and limits are validated');
await a.saveConnection(config);
const connection = await a.connection('chat');
const secret = await a.secret('MODEL_KEY');
assert(connection && secret);
const concurrent = await Promise.allSettled(
  Array.from({ length: 12 }, (_, index) =>
    a.reserve(connection, secret, `user:${index}`, 'https://app.example')
  )
);
assert.equal(concurrent.filter((r) => r.status === 'fulfilled').length, 2);
check('parallel reservations cannot exceed app concurrency');
const reserved = concurrent
  .filter(
    (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof a.reserve>>> =>
      r.status === 'fulfilled'
  )
  .map((r) => r.value);
await assert.rejects(b.consume(reserved[0].ticket, 'chat', 'https://app.example'));
await assert.rejects(a.consume(reserved[0].ticket, 'other', 'https://app.example'));
await assert.rejects(a.consume(reserved[0].ticket, 'chat', 'https://evil.example'));
const consumes = await Promise.allSettled([
  a.consume(reserved[0].ticket, 'chat', 'https://app.example'),
  a.consume(reserved[0].ticket, 'chat', 'https://app.example'),
]);
assert.equal(consumes.filter((r) => r.status === 'fulfilled').length, 1);
check('tickets are scoped by app, connection and origin and consumed once');
for (const lease of reserved) await a.finish(lease.id);
const userLease = await a.reserve(connection, secret, 'same-user', 'https://app.example');
await assert.rejects(a.reserve(connection, secret, 'same-user', 'https://app.example'));
await a.finish(userLease.id);
check('user concurrency is enforced and completion releases it');
const finalLease = await a.reserve(connection, secret, 'final', 'https://app.example');
await a.finish(finalLease.id);
await assert.rejects(a.reserve(connection, secret, 'fifth', 'https://app.example'));
check('failed and ended attempts remain in daily request budget');
await a.saveConnection({ ...config, limits: { ...config.limits, appDaily: 20, userDaily: 20 } });
const updated = await a.connection('chat');
assert(updated);
const revokeLease = await a.reserve(updated, secret, 'revoke', 'https://app.example');
await a.saveSecret(
  'MODEL_KEY',
  await encryptSecret(keys, 'project-a', 'MODEL_KEY', 2, 'replacement-secret'),
  2
);
await assert.rejects(a.consume(revokeLease.ticket, 'chat', 'https://app.example'));
await assert.rejects(a.reserve(updated, secret, 'old-version', 'https://app.example'));
check('Secret rotation invalidates outstanding tickets and stale reservations');
const newSecret = await a.secret('MODEL_KEY');
assert(newSecret);
const disableLease = await a.reserve(updated, newSecret, 'disable', 'https://app.example');
await a.saveConnection({ ...config, enabled: false });
await assert.rejects(a.consume(disableLease.ticket, 'chat', 'https://app.example'));
await assert.rejects(a.reserve(updated, newSecret, 'disabled', 'https://app.example'));
check('connection changes revoke tickets and reject stale configuration');
await a.deleteSecret('MODEL_KEY');
assert.equal(await a.secret('MODEL_KEY'), null);
check('Secret deletion removes stored ciphertext');
for (const key of ['abcabc', 'test-upstream-secret', '密钥-abc']) {
  const input = new TextEncoder().encode(`before:${key}:${key}:after`);
  for (let width = 1; width <= input.length; width++) {
    let offset = 0;
    let ended = 0;
    const source = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset >= input.length) return controller.close();
        controller.enqueue(input.slice(offset, offset + width));
        offset += width;
      },
    });
    const output = await Promise.race([
      new Response(protectedStream(source, key, () => ended++)).text(),
      new Promise<never>((_, reject) => {
        const timer = setTimeout(() => reject(new Error('Stream stalled on a short chunk')), 1000);
        timer.unref();
      }),
    ]);
    assert.equal(output, 'before:[redacted]:[redacted]:after', `${key}/${width}`);
    assert.equal(ended, 1);
  }
}
check(
  'streamed credentials are redacted at every UTF-8 and overlapping chunk boundary without stalling'
);
let canceled = false;
let cleanup = 0;
const cancellationSource = new ReadableStream<Uint8Array>({
  cancel() {
    canceled = true;
  },
});
await protectedStream(cancellationSource, 'secret', () => cleanup++).cancel();
assert(canceled);
assert.equal(cleanup, 1);
check('downstream cancellation propagates upstream and releases the call');
const requestAbort = new AbortController();
let inputCanceled = false;
const pendingInput = new ReadableStream<Uint8Array>({
  cancel() {
    inputCanceled = true;
  },
});
const pendingRead = limitedText(
  new Request('https://fixture.invalid', {
    method: 'POST',
    body: pendingInput,
    duplex: 'half',
  } as RequestInit),
  100,
  requestAbort.signal
);
requestAbort.abort();
await assert.rejects(pendingRead, /canceled or timed out/);
assert(inputCanceled);
await assert.rejects(
  limitedText(
    new Request('https://fixture.invalid', { method: 'POST', body: 'x'.repeat(101) }),
    100
  ),
  /too large/
);
check('slow uploads abort on revocation or deadline, and input is bounded before accumulation');
sqlite.close();
console.log(`${checks} gateway invariant checks passed.`);
