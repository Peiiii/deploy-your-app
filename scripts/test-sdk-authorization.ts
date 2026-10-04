import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import ts from 'typescript';
const source = ts.transpileModule(readFileSync('packages/app-sdk/src/web/auth.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
class StorageMock {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}
function browser(blocked = false) {
  const session = new StorageMock(),
    local = new StorageMock();
  const location = {
    href: 'https://xiaoban-voice.gemigo.app/chat?foo=1#thread',
    origin: 'https://xiaoban-voice.gemigo.app',
    hostname: 'xiaoban-voice.gemigo.app',
    assign(url: string) {
      this.href = url;
    },
  };
  const popup = {
    closed: false,
    location: { href: 'about:blank' },
    close() {
      this.closed = true;
    },
  };
  const listeners = new Set<(event: unknown) => void>();
  const window = {
    location,
    navigator: { userAgent: 'Desktop' },
    sessionStorage: session,
    localStorage: local,
    open: () => (blocked ? null : popup),
    history: {
      replaceState(_state: unknown, _unused: string, url: string) {
        location.href = url;
      },
    },
    setTimeout,
    clearTimeout,
    setInterval: (fn: () => void) => setInterval(fn, 5),
    clearInterval,
    addEventListener(_name: string, fn: (event: unknown) => void) {
      listeners.add(fn);
    },
    removeEventListener(_name: string, fn: (event: unknown) => void) {
      listeners.delete(fn);
    },
  };
  const requests: { url: string; body: Record<string, string> }[] = [];
  const fetch = async (url: string, options: { body: string }) => {
    const body = JSON.parse(options.body);
    requests.push({ url, body });
    return {
      ok: true,
      json: async () =>
        url.endsWith('/sdk/auth-requests')
          ? { authorizationUrl: 'https://gemigo.io/auth/authorize?request=sample' }
          : {
              accessToken: 'test-token',
              appId: 'xiaoban-voice',
              appUserId: 'app-user',
              scopes: ['identity:basic'],
              expiresIn: 3600,
            },
    };
  };
  const exports: {
    webAuth?: {
      login(options: Record<string, unknown>): Promise<unknown>;
      handleRedirectCallback(): Promise<unknown>;
      getAccessToken(): string | null;
    };
  } = {};
  const context = createContext({
    window,
    fetch,
    exports,
    crypto,
    AbortController,
    URL,
    TextEncoder,
    Uint8Array,
    btoa,
    setTimeout,
    clearTimeout,
    require: () => ({
      SDKError: class extends Error {
        constructor(_code: string, message: string) {
          super(message);
        }
      },
    }),
  });
  runInContext(source, context);
  const auth = exports.webAuth!;
  const message = (data: unknown, origin = 'https://gemigo.io', source: unknown = popup) =>
    listeners.forEach((fn) => fn({ origin, source, data }));
  return { auth, window, requests, session, popup, message, listeners };
}
async function until(predicate: () => boolean) {
  for (let i = 0; i < 200; i++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  throw new Error('expected SDK transition did not occur');
}
const redirect = browser();
void redirect.auth.login({ display: 'redirect', persist: 'session' });
await until(() => redirect.window.location.href.startsWith('https://gemigo.io/auth/authorize'));
assert.equal(redirect.requests[0].body.mode, 'redirect');
assert.equal('codeVerifier' in redirect.requests[0].body, false);
const pending = JSON.parse(redirect.session.getItem('gemigo:sdk-auth:redirect:v1')!);
assert.equal(pending.returnUrl, 'https://xiaoban-voice.gemigo.app/chat?foo=1#thread');
redirect.window.location.href = `https://xiaoban-voice.gemigo.app/?gemigo_code=one-use&gemigo_state=${pending.state}`;
const first = redirect.auth.handleRedirectCallback(),
  second = redirect.auth.handleRedirectCallback();
assert.equal(first, second);
await first;
assert.equal(redirect.auth.getAccessToken(), 'test-token');
assert.equal(redirect.requests.filter((r) => r.url.endsWith('/sdk/token')).length, 1);
assert.equal(redirect.window.location.href, pending.returnUrl);
assert.equal(redirect.session.getItem('gemigo:sdk-auth:redirect:v1'), null);
assert.equal(await redirect.auth.handleRedirectCallback(), null);
for (const scenario of ['state', 'expired', 'cancel', 'path']) {
  const b = browser();
  b.session.setItem(
    'gemigo:sdk-auth:redirect:v1',
    JSON.stringify({ ...pending, expiresAt: scenario === 'expired' ? 0 : Date.now() + 10000 })
  );
  b.window.location.href = `https://xiaoban-voice.gemigo.app/${scenario === 'path' ? 'elsewhere' : ''}?gemigo_${scenario === 'cancel' ? 'error=access_denied' : 'code=code'}&gemigo_state=${scenario === 'state' ? 'wrong' : pending.state}`;
  await assert.rejects(b.auth.handleRedirectCallback(), /mismatch|expired|cancelled|address/);
  assert.equal(b.requests.length, 0, `${scenario}: code must not be exchanged`);
  assert.equal(new URL(b.window.location.href).searchParams.has('gemigo_code'), false);
  assert.equal(new URL(b.window.location.href).searchParams.has('gemigo_state'), false);
}
const auto = browser(true);
void auto.auth.login({ display: 'auto' });
await until(() => auto.window.location.href.startsWith('https://gemigo.io/auth/authorize'));
assert.equal(auto.requests[0].body.mode, 'redirect');
const mobile = browser();
mobile.window.navigator.userAgent = 'iPhone';
void mobile.auth.login({ display: 'auto' });
await until(() => mobile.window.location.href.startsWith('https://gemigo.io/auth/authorize'));
assert.equal(mobile.requests[0].body.mode, 'redirect');
const blocked = browser(true);
await assert.rejects(blocked.auth.login({}), /Popup blocked/);
assert.equal(blocked.requests.length, 0);
const popup = browser();
const login = popup.auth.login({ persist: 'memory' });
await until(() => popup.listeners.size === 1);
const state = popup.requests[0].body.state;
const payload = { type: 'gemigo:sdk-auth-code', code: 'code', state };
popup.message(payload, 'https://attacker.example');
popup.message(payload, 'https://gemigo.io', {});
popup.message({ ...payload, state: 'wrong' });
assert.equal(popup.requests.length, 1);
popup.message(payload);
await login;
assert.equal(popup.auth.getAccessToken(), 'test-token');
assert.equal(popup.popup.closed, true);
assert.equal(popup.listeners.size, 0);
assert.equal(popup.session.data.size, 0);
const closed = browser();
const closeLogin = closed.auth.login({});
await until(() => closed.listeners.size === 1);
closed.popup.closed = true;
await assert.rejects(closeLogin, /window closed/);
assert.equal(closed.listeners.size, 0);
const timeout = browser();
await assert.rejects(timeout.auth.login({ timeoutMs: 10 }), /timed out/);
assert.equal(timeout.listeners.size, 0);
console.log(
  'PASS: actual SDK redirect/state/TTL/cancel/URL restoration/cleanup/single flight, popup source/origin/state/success/close/timeout, mobile and blocked auto fallback'
);
