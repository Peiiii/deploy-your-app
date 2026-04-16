import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';

async function withTempHome(run) {
  const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), 'gemigo-cli-home-'));
  const previousHome = process.env.HOME;
  process.env.HOME = tempHome;

  try {
    return await run(tempHome);
  } finally {
    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }
    await fs.rm(tempHome, { recursive: true, force: true });
  }
}

test('parseManifest accepts a multi-locale manifest', async () => {
  const { parseManifest } = await import('../dist/config.js');

  const manifest = parseManifest({
    visibility: 'public',
    category: 'Tools',
    tags: ['static', 'ai'],
    defaultLocale: 'en',
    locales: {
      en: {
        name: 'Static App',
        description: 'A static app',
      },
      'zh-CN': {
        name: '静态应用',
        description: '一个静态应用',
      },
    },
  });

  assert.equal(manifest.defaultLocale, 'en');
  assert.equal(manifest.locales['zh-CN'].name, '静态应用');
});

test('validateStaticDirectory rejects a directory with a top-level package.json', async () => {
  const { validateStaticDirectory } = await import('../dist/static-site.js');
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gemigo-cli-site-'));

  try {
    await fs.writeFile(path.join(tempDir, 'index.html'), '<html></html>', 'utf8');
    await fs.writeFile(path.join(tempDir, 'package.json'), '{}', 'utf8');

    await assert.rejects(
      () => validateStaticDirectory(tempDir),
      /must not contain a top-level package\.json/,
    );
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('GemigoApiClient.exchangeDeviceToken captures the session cookie', async () => {
  const { GemigoApiClient } = await import('../dist/api.js');

  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    assert.equal(url.pathname, '/api/v1/auth/desktop/login');
    response.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': 'session_id=device-session; Path=/; HttpOnly; Secure; SameSite=Lax',
    });
    response.end(
      JSON.stringify({
        user: {
          id: 'user_1',
          email: 'cli@example.com',
          handle: 'cli-user',
          displayName: 'CLI User',
          avatarUrl: null,
        },
      }),
    );
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;

  try {
    const client = new GemigoApiClient(origin);
    const result = await client.exchangeDeviceToken('token-123');
    assert.equal(result.cookie, 'session_id=device-session');
    assert.equal(result.user.displayName, 'CLI User');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('deployStaticApp creates a project and completes a ZIP deployment', async () => {
  await withTempHome(async () => {
    const { saveSession } = await import('../dist/session-store.js');
    const { deployStaticApp } = await import('../dist/deploy.js');

    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gemigo-cli-project-'));
    const staticDir = path.join(projectRoot, 'site');
    await fs.mkdir(staticDir, { recursive: true });
    await fs.writeFile(
      path.join(staticDir, 'index.html'),
      '<!doctype html><html><body>Hello</body></html>',
      'utf8',
    );

    const manifestPath = path.join(projectRoot, 'gemigo.app.json');
    await fs.writeFile(
      manifestPath,
      JSON.stringify(
        {
          sourceDir: './site',
          slug: 'hello-static',
          visibility: 'public',
          category: 'Tools',
          tags: ['static', 'hello'],
          defaultLocale: 'en',
          locales: {
            en: {
              name: 'Hello Static',
              description: 'A hello world static app.',
            },
            'zh-CN': {
              name: '你好静态站点',
              description: '一个 hello world 静态应用。',
            },
          },
        },
        null,
        2,
      ),
      'utf8',
    );

    let createProjectBody = null;
    let deployBody = null;

    const server = http.createServer((request, response) => {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');

      if (url.pathname === '/api/v1/me') {
        assert.equal(request.headers.cookie, 'session_id=saved-session');
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(
          JSON.stringify({
            user: {
              id: 'user_1',
              email: 'saved@example.com',
              handle: 'saved',
              displayName: 'Saved User',
              avatarUrl: null,
            },
          }),
        );
        return;
      }

      if (url.pathname === '/api/v1/projects' && request.method === 'POST') {
        let raw = '';
        request.on('data', (chunk) => {
          raw += chunk.toString();
        });
        request.on('end', () => {
          createProjectBody = JSON.parse(raw);
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(
            JSON.stringify({
              id: 'project_1',
              name: 'Hello Static',
              slug: 'hello-static',
            }),
          );
        });
        return;
      }

      if (url.pathname === '/api/v1/deploy' && request.method === 'POST') {
        let raw = '';
        request.on('data', (chunk) => {
          raw += chunk.toString();
        });
        request.on('end', () => {
          deployBody = JSON.parse(raw);
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ deploymentId: 'deploy_1' }));
        });
        return;
      }

      if (url.pathname === '/api/v1/deployments/deploy_1/stream') {
        response.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });
        response.write(
          'data: {"type":"log","message":"Uploading...","level":"info"}\n\n',
        );
        response.write(
          'data: {"type":"status","status":"SUCCESS","projectMetadata":{"slug":"hello-static","url":"https://hello-static.example.com/"}}\n\n',
        );
        response.end();
        return;
      }

      response.writeHead(404, { 'Content-Type': 'text/plain' });
      response.end('Not Found');
    });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const origin = `http://127.0.0.1:${address.port}`;

    try {
      await saveSession({
        origin,
        cookie: 'session_id=saved-session',
        user: {
          id: 'user_1',
          email: 'saved@example.com',
          handle: 'saved',
          displayName: 'Saved User',
          avatarUrl: null,
        },
        updatedAt: new Date().toISOString(),
      });

      const output = [];
      const previousCwd = process.cwd();
      process.chdir(projectRoot);
      try {
        const result = await deployStaticApp({
          origin,
          configPath: manifestPath,
          onOutput: (line) => output.push(line),
        });

        assert.equal(result.projectId, 'project_1');
        assert.equal(result.deploymentId, 'deploy_1');
        assert.equal(result.slug, 'hello-static');
        assert.equal(result.url, 'https://hello-static.example.com/');
      } finally {
        process.chdir(previousCwd);
      }

      assert.equal(createProjectBody.isPublic, true);
      assert.equal(createProjectBody.metadata.localization.defaultLocale, 'en');
      assert.equal(
        createProjectBody.metadata.localization.locales['zh-CN'].name,
        '你好静态站点',
      );
      assert.equal(deployBody.id, 'project_1');
      assert.equal(deployBody.sourceType, 'zip');
      assert.match(deployBody.zipData, /^[A-Za-z0-9+/=]+$/);
      assert.ok(output.some((line) => line.includes('Status: SUCCESS')));
    } finally {
      await new Promise((resolve) => server.close(resolve));
      await fs.rm(projectRoot, { recursive: true, force: true });
    }
  });
});
