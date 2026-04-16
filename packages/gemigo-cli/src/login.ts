import * as http from 'node:http';
import { spawn } from 'node:child_process';
import type { StoredSession } from './types.js';
import { GemigoApiClient } from './api.js';
import { saveSession } from './session-store.js';

export type LoginProvider = 'github' | 'google';

function renderLoginResultHtml(message: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>GemiGo CLI Login</title>
    <style>
      body { font-family: sans-serif; padding: 32px; line-height: 1.5; }
      main { max-width: 560px; margin: 0 auto; }
      code { background: #f3f4f6; padding: 2px 6px; border-radius: 6px; }
    </style>
  </head>
  <body>
    <main>
      <h1>GemiGo CLI</h1>
      <p>${message}</p>
      <p>You can close this window and return to <code>gemigo</code>.</p>
    </main>
  </body>
</html>`;
}

function openUrlInBrowser(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let command = 'xdg-open';
    let args = [url];

    if (process.platform === 'darwin') {
      command = 'open';
    } else if (process.platform === 'win32') {
      command = 'cmd';
      args = ['/c', 'start', '', url];
    }

    const child = spawn(command, args, {
      stdio: 'ignore',
      detached: true,
    });
    child.on('error', reject);
    child.unref();
    resolve();
  });
}

async function createLoopbackListener(): Promise<{
  callbackUrl: string;
  waitForToken: () => Promise<string>;
  close: () => Promise<void>;
}> {
  let resolveToken: ((token: string) => void) | null = null;
  let rejectToken: ((error: Error) => void) | null = null;
  const tokenPromise = new Promise<string>((resolve, reject) => {
    resolveToken = resolve;
    rejectToken = reject;
  });

  const server = http.createServer((request, response) => {
    const url = new URL(
      request.url ?? '/',
      `http://${request.headers.host ?? '127.0.0.1'}`,
    );

    if (url.pathname !== '/callback') {
      response.writeHead(404, { 'Content-Type': 'text/plain' });
      response.end('Not Found');
      return;
    }

    const token = url.searchParams.get('token');
    if (!token) {
      response.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(renderLoginResultHtml('Login failed: missing device token.'));
      rejectToken?.(new Error('Login callback did not include a token.'));
      return;
    }

    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(
      renderLoginResultHtml('Login succeeded and GemiGo CLI received the callback.'),
    );
    resolveToken?.(token);
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve());
    server.once('error', reject);
  });

  const address = server.address();
  if (!address || typeof address !== 'object') {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    throw new Error('Failed to start the local login callback server.');
  }

  return {
    callbackUrl: `http://127.0.0.1:${address.port}/callback`,
    waitForToken: async () => {
      const timeout = setTimeout(() => {
        rejectToken?.(
          new Error('Login timed out waiting for the browser callback.'),
        );
      }, 5 * 60 * 1000);

      try {
        return await tokenPromise;
      } finally {
        clearTimeout(timeout);
      }
    },
    close: async () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}

export async function loginWithBrowser(options: {
  origin: string;
  provider: LoginProvider;
  openBrowser: boolean;
}): Promise<StoredSession> {
  const { origin, provider, openBrowser } = options;
  const listener = await createLoopbackListener();

  try {
    const authUrl = new URL(`/api/v1/auth/${provider}/start`, origin);
    authUrl.searchParams.set('redirect', listener.callbackUrl);

    if (openBrowser) {
      await openUrlInBrowser(authUrl.toString());
    } else {
      process.stdout.write(`${authUrl.toString()}\n`);
    }

    const token = await listener.waitForToken();
    const client = new GemigoApiClient(origin);
    const result = await client.exchangeDeviceToken(token);

    const session: StoredSession = {
      origin,
      cookie: result.cookie,
      user: result.user,
      updatedAt: new Date().toISOString(),
    };

    await saveSession(session);
    return session;
  } finally {
    await listener.close();
  }
}
