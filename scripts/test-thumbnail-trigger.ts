import assert from 'node:assert/strict';
import worker, { triggerCapture } from '../workers/thumbnail-trigger/worker.ts';

const originalFetch = globalThis.fetch;
const env = { GITHUB_DISPATCH_TOKEN: 'test-secret' };
const requests: Array<{ url: string; init?: RequestInit }> = [];
let responses: Response[] = [];
globalThis.fetch = async (input, init) => {
  requests.push({ url: String(input), init });
  const response = responses.shift();
  if (!response) throw new Error('Unexpected GitHub request');
  return response;
};

const runs = (statuses: string[]) => new Response(JSON.stringify({
  workflow_runs: statuses.map(status => ({ status })),
}));
const reset = (...next: Response[]) => {
  requests.length = 0;
  responses = next;
};

try {
  reset(runs(['completed']), new Response(null, { status: 204 }));
  assert.equal(await triggerCapture(env), 'dispatched');
  assert.equal(requests.length, 2);
  assert.equal(requests[1].init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(requests[1].init?.body)), { ref: 'master' });
  assert.equal(new Headers(requests[1].init?.headers).get('Authorization'), 'Bearer test-secret');
  assert.ok(requests.every(request => request.init?.signal instanceof AbortSignal));

  for (const status of ['in_progress', 'queued', 'waiting', 'pending', 'requested']) {
    reset(runs([status]));
    assert.equal(await triggerCapture(env), 'busy');
    assert.equal(requests.length, 1, `must not duplicate a ${status} run`);
  }

  reset(new Response('do not leak error details or tokens', { status: 401 }));
  await assert.rejects(triggerCapture(env), /^Error: GitHub workflow check failed: HTTP 401$/);
  assert.equal(requests.length, 1);

  reset(runs(['completed']), new Response('secret error body', { status: 503 }));
  await assert.rejects(triggerCapture(env), /^Error: GitHub workflow dispatch failed: HTTP 503$/);
  // The next Cron invocation is independent and retries after a failure.
  reset(runs(['completed']), new Response(null, { status: 204 }));
  await worker.scheduled({ scheduledTime: 123 }, env);
  assert.equal(requests.length, 2);

  reset(new Response('{}'));
  await assert.rejects(triggerCapture(env), /Invalid GitHub workflow response/);
  assert.equal(requests.length, 1);

  reset();
  await assert.rejects(triggerCapture({ GITHUB_DISPATCH_TOKEN: '' }), /Missing GitHub dispatch credential/);
  assert.equal(requests.length, 0);
  console.log('Thumbnail trigger regression checks passed');
} finally {
  globalThis.fetch = originalFetch;
}
