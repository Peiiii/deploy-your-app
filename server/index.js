import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.SERVER_PORT || 4173;

// Simple in-memory stores for MVP
const projects = [];
const deployments = new Map(); // id -> { status, logs, project }
const streams = new Map(); // id -> Set<res>

const rootDir = path.resolve(__dirname, '..');
const buildsRoot = path.join(rootDir, '.deploy-builds');
const staticRoot = path.join(rootDir, 'apps');

fs.mkdirSync(buildsRoot, { recursive: true });
fs.mkdirSync(staticRoot, { recursive: true });

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve built apps under /apps/:project
app.use('/apps', express.static(staticRoot));

function broadcastEvent(id, payload) {
  const listeners = streams.get(id);
  if (!listeners) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of listeners) {
    res.write(data);
  }
}

function appendLog(id, message, level = 'info') {
  const deployment = deployments.get(id);
  if (!deployment) return;
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, message, level };
  deployment.logs.push(logEntry);
  broadcastEvent(id, { type: 'log', message, level });
}

function updateStatus(id, status) {
  const deployment = deployments.get(id);
  if (!deployment) return;
  deployment.status = status;
  broadcastEvent(id, { type: 'status', status });

  if (status === 'SUCCESS' || status === 'FAILED') {
    const listeners = streams.get(id);
    if (!listeners) return;
    for (const res of listeners) {
      res.end();
    }
    streams.delete(id);
  }
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'app';
}

async function copyDir(src, dest) {
  await fs.promises.mkdir(dest, { recursive: true });
  const entries = await fs.promises.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(from, to);
    } else if (entry.isFile()) {
      await fs.promises.copyFile(from, to);
    }
  }
}

function runCommand(id, command, args, options) {
  return new Promise((resolve, reject) => {
    appendLog(id, `$ ${command} ${args.join(' ')}`, 'info');

    const child = spawn(command, args, {
      ...options,
      shell: false,
      env: { ...process.env },
    });

    child.stdout.on('data', (data) => {
      const lines = data.toString().split(/\r?\n/).filter(Boolean);
      for (const line of lines) appendLog(id, line, 'info');
    });

    child.stderr.on('data', (data) => {
      const lines = data.toString().split(/\r?\n/).filter(Boolean);
      for (const line of lines) appendLog(id, line, 'warning');
    });

    child.on('error', (err) => {
      appendLog(id, `Command failed: ${err.message}`, 'error');
      reject(err);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        const error = new Error(`Command "${command}" exited with code ${code}`);
        appendLog(id, error.message, 'error');
        reject(error);
      }
    });
  });
}

async function runDeployment(id) {
  const deployment = deployments.get(id);
  if (!deployment) return;

  const project = deployment.project;
  const repoUrl = project.repoUrl;
  const slug = slugify(project.name);

  const workDir = path.join(buildsRoot, id);
  const outputDir = path.join(staticRoot, slug);

  try {
    updateStatus(id, 'BUILDING');
    appendLog(id, `Starting deployment for "${project.name}"`, 'info');

    await fs.promises.mkdir(workDir, { recursive: true });

    appendLog(id, `Cloning repository ${repoUrl}`, 'info');
    await runCommand(id, 'git', ['clone', '--depth=1', repoUrl, workDir], {
      cwd: buildsRoot,
    });

    appendLog(id, 'Installing dependencies with npm', 'info');
    await runCommand(id, 'npm', ['install'], { cwd: workDir });

    appendLog(id, 'Building project (npm run build)', 'info');
    await runCommand(id, 'npm', ['run', 'build'], { cwd: workDir });

    const candidates = ['dist', 'build', 'out'];
    let distPath = null;
    for (const candidate of candidates) {
      const full = path.join(workDir, candidate);
      if (fs.existsSync(full)) {
        distPath = full;
        break;
      }
    }

    if (!distPath) {
      throw new Error(
        'Could not find build output directory (tried dist/, build/, out/)',
      );
    }

    appendLog(id, `Copying build output to ${outputDir}`, 'info');
    await fs.promises.rm(outputDir, { recursive: true, force: true });
    await copyDir(distPath, outputDir);

    appendLog(
      id,
      `Deployment complete. App is available at /apps/${slug}/`,
      'success',
    );

    updateStatus(id, 'SUCCESS');
  } catch (err) {
    appendLog(
      id,
      `Deployment failed: ${err && err.message ? err.message : String(err)}`,
      'error',
    );
    updateStatus(id, 'FAILED');
  }
}

// ---- API routes ----

// Projects CRUD (MVP: in-memory)
app.get('/api/v1/projects', (req, res) => {
  res.json(projects);
});

app.post('/api/v1/projects', (req, res) => {
  const { name, url: _urlFromClient, sourceType, identifier } = req.body || {};

  if (!name || !identifier) {
    return res.status(400).json({ error: 'name and identifier are required' });
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const slug = slugify(name);

  // We always compute the accessible URL relative to the current origin.
  const url = `/apps/${encodeURIComponent(slug)}/`;

  const project = {
    id,
    name,
    repoUrl: identifier,
    sourceType,
    lastDeployed: now,
    status: 'Live',
    url,
    framework: 'Unknown',
  };

  projects.unshift(project);
  res.json(project);
});

// Code analysis (MVP: stub, does not call Gemini yet)
app.post('/api/v1/analyze', (req, res) => {
  const { sourceCode } = req.body || {};
  if (typeof sourceCode !== 'string') {
    return res.status(400).json({ error: 'sourceCode must be a string' });
  }

  const headerHint =
    '// TODO: Integrate real Gemini-based security hardening on the backend.\n';

  res.json({
    refactoredCode: `${headerHint}${sourceCode}`,
    explanation:
      'MVP stub: this backend currently echoes your code with a note. In the next step it will call Gemini and inject a secure proxy base URL.',
  });
});

// Start deployment job
app.post('/api/v1/deploy', (req, res) => {
  const project = req.body;

  if (!project || !project.name || !project.repoUrl) {
    return res
      .status(400)
      .json({ error: 'project.name and project.repoUrl are required' });
  }

  const id = randomUUID();
  deployments.set(id, {
    status: 'IDLE',
    logs: [],
    project,
  });

  res.json({ deploymentId: id });

  // Fire and forget async job
  runDeployment(id).catch((err) => {
    console.error('Deployment job failed', err);
  });
});

// Deployment log stream (SSE)
app.get('/api/v1/deployments/:id/stream', (req, res) => {
  const { id } = req.params;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write('\n');

  let listeners = streams.get(id);
  if (!listeners) {
    listeners = new Set();
    streams.set(id, listeners);
  }
  listeners.add(res);

  // Send existing logs and status immediately
  const deployment = deployments.get(id);
  if (deployment) {
    for (const log of deployment.logs) {
      res.write(
        `data: ${JSON.stringify({
          type: 'log',
          message: log.message,
          level: log.level || 'info',
        })}\n\n`,
      );
    }
    res.write(
      `data: ${JSON.stringify({
        type: 'status',
        status: deployment.status,
      })}\n\n`,
    );
  }

  const keepAlive = setInterval(() => {
    res.write(':\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(keepAlive);
    const set = streams.get(id);
    if (set) {
      set.delete(res);
      if (set.size === 0) {
        streams.delete(id);
      }
    }
  });
});

app.listen(port, () => {
  console.log(`Backend server listening on http://localhost:${port}`);
});

