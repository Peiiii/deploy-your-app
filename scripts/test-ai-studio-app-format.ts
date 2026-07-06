import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

type AdmZipArchive = {
  addLocalFile(localPath: string, zipPath?: string): void;
  toBuffer(): Buffer;
};

type AdmZipConstructor = new () => AdmZipArchive;

const serverRequire = createRequire(
  new URL('../server/package.json', import.meta.url),
);
const AdmZip = serverRequire('adm-zip') as AdmZipConstructor;

process.env.STORAGE_TYPE = process.env.STORAGE_TYPE ?? 'file';
process.env.DEPLOY_TARGET = process.env.DEPLOY_TARGET ?? 'local';

const { applyFixesForDeployment } = await import(
  '../server/src/modules/deployment/fixPipeline.js'
);
const { deploymentService } = await import(
  '../server/src/modules/deployment/deployment.service.js'
);
const { deployments } = await import(
  '../server/src/modules/deployment/state.js'
);
const { CONFIG } = await import('../server/src/common/config/config.js');
const { SourceType } = await import('../server/src/common/types.js');

async function writeAIStudioFixture(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, 'metadata.json'),
    JSON.stringify(
      {
        name: 'AI Studio Smoke',
        requestFramePermissions: ['clipboard-read'],
      },
      null,
      2,
    ),
    'utf8',
  );
  await fs.writeFile(
    path.join(dir, 'index.html'),
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Studio Smoke</title>
    <script type="importmap">
      {
        "imports": {
          "react": "https://esm.sh/react@^19.2.0",
          "react-dom/client": "https://esm.sh/react-dom@^19.2.0/client",
          "lucide-react": "https://esm.sh/lucide-react@^0.555.0"
        }
      }
    </script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`,
    'utf8',
  );
  await fs.writeFile(
    path.join(dir, 'index.tsx'),
    `import React from 'react';
import { createRoot } from 'react-dom/client';
import { Sparkles } from 'lucide-react';
import App from './App';
import './style.css';

createRoot(document.getElementById('root')!).render(
  <App icon={<Sparkles aria-hidden="true" />} />,
);
`,
    'utf8',
  );
  await fs.writeFile(
    path.join(dir, 'App.tsx'),
    `import type React from 'react';

export default function App(props: { icon: React.ReactNode }) {
  return (
    <main className="shell" data-smoke="ai-studio-app">
      <span className="icon">{props.icon}</span>
      <h1>AI Studio smoke passed</h1>
    </main>
  );
}
`,
    'utf8',
  );
  await fs.writeFile(
    path.join(dir, 'style.css'),
    `body {
  margin: 0;
  font-family: Inter, system-ui, sans-serif;
}

.shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
}

.icon {
  color: #0f766e;
}
`,
    'utf8',
  );
}

async function zipDirectoryToBase64(dir: string): Promise<string> {
  const zip = new AdmZip();
  const stack = [''];

  while (stack.length > 0) {
    const relDir = stack.pop() as string;
    const current = path.join(dir, relDir);
    const entries = await fs.readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      const relPath = relDir ? path.join(relDir, entry.name) : entry.name;
      const fullPath = path.join(dir, relPath);

      if (entry.isDirectory()) {
        stack.push(relPath);
        continue;
      }

      if (entry.isFile()) {
        const zipPath = path.dirname(relPath);
        zip.addLocalFile(fullPath, zipPath === '.' ? '' : zipPath);
      }
    }
  }

  return zip.toBuffer().toString('base64');
}

async function assertGeneratedWrapper(): Promise<void> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'aistudio-fix-'));
  const workDir = path.join(tempRoot, 'app');
  const deploymentId = `aistudio-fix-${randomUUID()}`;

  deployments.set(deploymentId, {
    status: 'BUILDING',
    logs: [],
    project: {
      id: deploymentId,
      name: 'AI Studio Smoke',
      repoUrl: 'local.zip',
      sourceType: SourceType.Zip,
      slug: 'ai-studio-smoke',
      lastDeployed: '',
      status: 'Building',
      framework: 'React',
      description: 'Smoke test',
      category: 'Tools',
      tags: ['ai-studio'],
      deployTarget: 'local',
    },
    workDir,
  });

  try {
    await writeAIStudioFixture(workDir);
    await applyFixesForDeployment(deploymentId, workDir);

    const packageJson = JSON.parse(
      await fs.readFile(path.join(workDir, 'package.json'), 'utf8'),
    ) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    const viteConfig = await fs.readFile(
      path.join(workDir, 'vite.config.ts'),
      'utf8',
    );
    const indexHtml = await fs.readFile(path.join(workDir, 'index.html'), 'utf8');
    const record = deployments.get(deploymentId);

    assert.equal(packageJson.scripts.build, 'vite build');
    assert.equal(packageJson.dependencies.react, '^19.2.0');
    assert.equal(packageJson.dependencies['react-dom'], '^19.2.0');
    assert.equal(packageJson.dependencies['lucide-react'], '^0.555.0');
    assert.equal(packageJson.devDependencies.vite, '^7.2.5');
    assert.match(viteConfig, /base:\s*'\.\/'/);
    assert.match(viteConfig, /process\.env\.GEMINI_API_KEY/);
    assert.match(indexHtml, /type="module" src="\.\/index\.tsx"/);
    assert.ok(
      record?.logs.some((log) =>
        log.message.includes('Detected AI Studio App export'),
      ),
    );
  } finally {
    deployments.delete(deploymentId);
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

async function assertFullStackRejected(): Promise<void> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'aistudio-server-'));
  const workDir = path.join(tempRoot, 'app');
  const deploymentId = `aistudio-server-${randomUUID()}`;

  deployments.set(deploymentId, {
    status: 'BUILDING',
    logs: [],
    project: {
      id: deploymentId,
      name: 'AI Studio Server',
      repoUrl: 'local.zip',
      sourceType: SourceType.Zip,
      slug: 'ai-studio-server',
      lastDeployed: '',
      status: 'Building',
      framework: 'React',
      description: 'Smoke test',
      category: 'Tools',
      tags: ['ai-studio'],
      deployTarget: 'local',
    },
    workDir,
  });

  try {
    await writeAIStudioFixture(workDir);
    await fs.mkdir(path.join(workDir, 'server'), { recursive: true });
    await fs.writeFile(
      path.join(workDir, 'server', 'index.ts'),
      `import express from 'express';

const app = express();
app.listen(3000);
`,
      'utf8',
    );

    await assert.rejects(
      () => applyFixesForDeployment(deploymentId, workDir),
      /server-side runtime/,
    );
  } finally {
    deployments.delete(deploymentId);
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

async function serveDirectory(
  root: string,
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
    const requestedPath =
      requestUrl.pathname === '/'
        ? '/index.html'
        : decodeURIComponent(requestUrl.pathname);
    const filePath = path.resolve(root, `.${requestedPath}`);

    if (!filePath.startsWith(path.resolve(root))) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }

    try {
      const content = await fs.readFile(filePath);
      response.writeHead(200);
      response.end(content);
    } catch {
      response.writeHead(404);
      response.end('Not Found');
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  assert.ok(address && typeof address === 'object');

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      }),
  };
}

async function assertDeployedAssetsAreReachable(appDir: string): Promise<void> {
  const server = await serveDirectory(appDir);

  try {
    const indexResponse = await fetch(`${server.baseUrl}/`);
    assert.equal(indexResponse.status, 200);
    const indexHtml = await indexResponse.text();
    assert.match(indexHtml, /assets\/index-/);

    const assetRefs = [...indexHtml.matchAll(/(?:src|href)="\.\/([^"]+)"/g)]
      .map((match) => match[1])
      .filter((value) => value.startsWith('assets/'));

    assert.ok(assetRefs.some((asset) => asset.endsWith('.js')));

    for (const asset of assetRefs) {
      const assetResponse = await fetch(`${server.baseUrl}/${asset}`);
      assert.equal(assetResponse.status, 200, `${asset} should be reachable`);
    }

    const jsAsset = assetRefs.find((asset) => asset.endsWith('.js'));
    assert.ok(jsAsset);
    const jsResponse = await fetch(`${server.baseUrl}/${jsAsset}`);
    const js = await jsResponse.text();
    assert.match(js, /AI Studio smoke passed/);
  } finally {
    await server.close();
  }
}

async function assertDeploymentSmoke(): Promise<void> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'aistudio-deploy-'));
  const sourceDir = path.join(tempRoot, 'source');
  const deploymentId = `aistudio-deploy-${randomUUID()}`;
  const slug = `ai-studio-smoke-${randomUUID().slice(0, 8)}`;
  const appDir = path.join(CONFIG.paths.staticRoot, slug);

  try {
    await writeAIStudioFixture(sourceDir);
    const zipData = await zipDirectoryToBase64(sourceDir);

    deployments.set(deploymentId, {
      status: 'IDLE',
      logs: [],
      project: {
        id: deploymentId,
        name: 'AI Studio Smoke',
        repoUrl: 'local-ai-studio-smoke.zip',
        sourceType: SourceType.Zip,
        slug,
        lastDeployed: '',
        status: 'Building',
        framework: 'React',
        description: 'AI Studio App format smoke test',
        category: 'Tools',
        tags: ['ai-studio', 'smoke'],
        deployTarget: 'local',
      },
      workDir: null,
      zipData,
    });

    await deploymentService.runDeployment(deploymentId);

    const record = deployments.get(deploymentId);
    assert.equal(record?.status, 'SUCCESS');
    assert.equal(record?.project.url, `/apps/${slug}/`);
    assert.ok(
      record?.logs.some((log) =>
        log.message.includes('Detected AI Studio App export'),
      ),
    );

    const indexHtml = await fs.readFile(path.join(appDir, 'index.html'), 'utf8');
    assert.match(indexHtml, /assets\/index-/);
    await assertDeployedAssetsAreReachable(appDir);
  } finally {
    deployments.delete(deploymentId);
    await fs.rm(appDir, { recursive: true, force: true });
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

await assertGeneratedWrapper();
await assertFullStackRejected();
await assertDeploymentSmoke();

console.log('AI Studio App format smoke test passed.');
