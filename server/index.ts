import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn, SpawnOptions } from 'child_process';
import {
  createPlatformAIProvider,
  PlatformAIAnalyzeResult,
} from './ai/platformProvider.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.SERVER_PORT || 4173;

// ----------------------
// Types & in-memory state
// ----------------------

type DeploymentStatus =
  | 'IDLE'
  | 'ANALYZING'
  | 'BUILDING'
  | 'DEPLOYING'
  | 'SUCCESS'
  | 'FAILED';

type LogLevel = 'info' | 'error' | 'success' | 'warning';

interface BuildLog {
  timestamp: string;
  message: string;
  level: LogLevel;
}

interface Project {
  id: string;
  name: string;
  repoUrl: string;
  sourceType?: 'github' | 'zip';
  analysisId?: string;
  lastDeployed: string;
  status: 'Live' | 'Building' | 'Failed' | 'Offline';
  url?: string;
  framework: 'React' | 'Vue' | 'Next.js' | 'Unknown';
}

interface DeploymentRecord {
  status: DeploymentStatus;
  logs: BuildLog[];
  project: Project;
  workDir: string | null;
}

interface AnalysisSession {
  workDir: string;
  repoUrl: string;
  filePath: string;
}

const projects: Project[] = [];
const deployments = new Map<string, DeploymentRecord>();
const streams = new Map<string, Set<ReturnType<typeof express.response['write']>>>();
const analysisSessions = new Map<string, AnalysisSession>();

const rootDir = path.resolve(__dirname, '..');
const buildsRoot = path.join(rootDir, '.deploy-builds');
const staticRoot = path.join(rootDir, 'apps');

fs.mkdirSync(buildsRoot, { recursive: true });
fs.mkdirSync(staticRoot, { recursive: true });

const platformAI = createPlatformAIProvider();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve built apps under /apps/:project
app.use('/apps', express.static(staticRoot));

// ----------------------
// Helper functions
// ----------------------

function broadcastEvent(id: string, payload: unknown): void {
  const listeners = streams.get(id);
  if (!listeners) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of listeners) {
    res.write(data);
  }
}

function appendLog(id: string, message: string, level: LogLevel = 'info'): void {
  const deployment = deployments.get(id);
  if (!deployment) return;
  const timestamp = new Date().toISOString();
  const logEntry: BuildLog = { timestamp, message, level };
  deployment.logs.push(logEntry);
  broadcastEvent(id, { type: 'log', message, level });
}

function updateStatus(id: string, status: DeploymentStatus): void {
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

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'app'
  );
}

async function copyDir(src: string, dest: string): Promise<void> {
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

function runCommand(
  id: string,
  command: string,
  args: string[],
  options: SpawnOptions,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    appendLog(id, `$ ${command} ${args.join(' ')}`, 'info');

    const child = spawn(command, args, {
      ...options,
      shell: false,
      env: { ...process.env },
    });

    if (child.stdout) {
      child.stdout.on('data', (data) => {
        const lines = data.toString().split(/\r?\n/).filter(Boolean);
        for (const line of lines) appendLog(id, line, 'info');
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data) => {
        const lines = data.toString().split(/\r?\n/).filter(Boolean);
        for (const line of lines) appendLog(id, line, 'warning');
      });
    }

    child.on('error', (err) => {
      appendLog(id, `Command failed: ${String(err)}`, 'error');
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

// Best-effort scan to find a file in the repo that looks like an AI client.
async function findAIClientFile(
  repoRoot: string,
): Promise<{ filePath: string; content: string } | null> {
  const candidates: string[] = ['src', ''];
  const seen = new Set<string>();
  const patterns = ['@google/genai', 'GoogleGenAI', '@google-ai/generativelanguage'];

  while (candidates.length > 0) {
    const rel = candidates.shift() as string;
    const dir = path.join(repoRoot, rel);
    if (seen.has(dir)) continue;
    seen.add(dir);

    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const entryRel = path.join(rel, entry.name);
      const full = path.join(repoRoot, entryRel);

      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
          continue;
        }
        candidates.push(entryRel);
      } else if (entry.isFile()) {
        if (!/\.(t|j)sx?$/.test(entry.name)) continue;
        let content: string;
        try {
          content = await fs.promises.readFile(full, 'utf8');
        } catch {
          continue;
        }
        if (patterns.some((p) => content.includes(p))) {
          return {
            filePath: entryRel.replace(/\\/g, '/'),
            content,
          };
        }
      }
    }
  }

  return null;
}

async function prepareAnalysisSession(repoUrl: string): Promise<{
  analysisId: string;
  filePath: string;
  sourceCode: string;
}> {
  const analysisId = randomUUID();
  const workDir = path.join(buildsRoot, `analysis-${analysisId}`);

  await fs.promises.mkdir(workDir, { recursive: true });

  // Clone the repo into the analysis workdir
  const cloneArgs = ['clone', '--depth=1', repoUrl, workDir];
  await new Promise<void>((resolve, reject) => {
    const child = spawn('git', cloneArgs, {
      cwd: buildsRoot,
      shell: false,
      env: { ...process.env },
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`git clone exited with code ${code}`));
    });
  });

  const aiFile = await findAIClientFile(workDir);
  if (!aiFile) {
    throw new Error(
      'Could not find any AI client file in the repo (looked for @google/genai / GoogleGenAI).',
    );
  }

  analysisSessions.set(analysisId, {
    workDir,
    repoUrl,
    filePath: aiFile.filePath,
  });

  return {
    analysisId,
    filePath: aiFile.filePath,
    sourceCode: aiFile.content,
  };
}

async function runDeployment(id: string): Promise<void> {
  const deployment = deployments.get(id);
  if (!deployment) return;

  const project = deployment.project;
  const repoUrl = project.repoUrl;
  const analysisId = project.analysisId;
  const slug = slugify(project.name);

  // Reuse an existing prepared repo when analysis has been run, otherwise create a fresh workdir.
  let workDir = deployment.workDir;
  if (!workDir) {
    workDir = path.join(buildsRoot, id);
    deployment.workDir = workDir;
  }

  const outputDir = path.join(staticRoot, slug);

  try {
    updateStatus(id, 'BUILDING');
    appendLog(id, `Starting deployment for "${project.name}"`, 'info');

    await fs.promises.mkdir(workDir, { recursive: true });

    const gitDir = path.join(workDir, '.git');
    if (!fs.existsSync(gitDir)) {
      appendLog(id, `Cloning repository ${repoUrl}`, 'info');
      await runCommand(id, 'git', ['clone', '--depth=1', repoUrl, workDir], {
        cwd: buildsRoot,
      });
    } else {
      appendLog(id, `Reusing prepared repository at ${workDir}`, 'info');
    }

    appendLog(id, 'Installing dependencies with npm', 'info');
    await runCommand(id, 'npm', ['install'], { cwd: workDir });

    appendLog(id, 'Building project (npm run build)', 'info');
    await runCommand(id, 'npm', ['run', 'build'], { cwd: workDir });

    const candidates = ['dist', 'build', 'out'];
    let distPath: string | null = null;
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
  } catch (err: unknown) {
    appendLog(
      id,
      `Deployment failed: ${
        err && (err as Error).message ? (err as Error).message : String(err)
      }`,
      'error',
    );
    updateStatus(id, 'FAILED');
  } finally {
    if (analysisId && analysisSessions.has(analysisId)) {
      analysisSessions.delete(analysisId);
    }
  }
}

// ----------------------
// API routes
// ----------------------

// Projects CRUD (MVP: in-memory)
app.get('/api/v1/projects', (req, res) => {
  res.json(projects);
});

app.post('/api/v1/projects', (req, res) => {
  const { name, sourceType, identifier } = req.body || {};

  if (!name || !identifier) {
    return res.status(400).json({ error: 'name and identifier are required' });
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const slug = slugify(String(name));

  // We always compute the accessible URL relative to the current origin.
  const url = `/apps/${encodeURIComponent(slug)}/`;

  const project: Project = {
    id,
    name: String(name),
    repoUrl: String(identifier),
    sourceType,
    lastDeployed: now,
    status: 'Live',
    url,
    framework: 'Unknown',
  };

  projects.unshift(project);
  res.json(project);
});

// Code analysis using platform AI (DashScope/Qwen by default)
app.post('/api/v1/analyze', async (req, res) => {
  try {
    const { sourceCode, repoUrl, analysisId } = req.body || {};

    let effectiveAnalysisId: string | undefined = analysisId;
    let session = effectiveAnalysisId
      ? analysisSessions.get(effectiveAnalysisId)
      : null;
    let codeToAnalyze: string | undefined;
    let sourceFilePath = session?.filePath;

    // If we have a repo URL, always prefer analyzing real repo code.
    if (!session && repoUrl) {
      const prepared = await prepareAnalysisSession(String(repoUrl));
      effectiveAnalysisId = prepared.analysisId;
      session = analysisSessions.get(effectiveAnalysisId);
      sourceFilePath = prepared.filePath;
      codeToAnalyze = prepared.sourceCode;
    }

    // If repo-based detection didn't succeed, fall back to the explicit snippet.
    if (
      !codeToAnalyze &&
      typeof sourceCode === 'string' &&
      sourceCode.length > 0
    ) {
      codeToAnalyze = sourceCode;
    }

    if (!codeToAnalyze) {
      return res.status(400).json({
        error:
          'sourceCode is required when repoUrl or analysisId are not provided, or when no AI client file can be detected.',
      });
    }

    const result: PlatformAIAnalyzeResult = await platformAI.analyzeUserCode({
      sourceCode: codeToAnalyze,
    });

    // If we have a prepared repo, write the refactored code back to the detected file.
    if (session && sourceFilePath) {
      const targetPath = path.join(session.workDir, sourceFilePath);
      await fs.promises.writeFile(targetPath, result.refactoredCode, 'utf8');
    }

    return res.json({
      refactoredCode: result.refactoredCode,
      explanation: result.explanation,
      analysisId: effectiveAnalysisId,
      sourceFilePath,
      originalCode: codeToAnalyze,
    });
  } catch (error) {
    console.error('Platform AI analyze error:', error);
    const headerHint =
      '// NOTE: Platform AI analysis failed. Returning your original code.\n';
    return res.status(500).json({
      refactoredCode: `${headerHint}${
        typeof req.body?.sourceCode === 'string' ? req.body.sourceCode : ''
      }`,
      explanation:
        'Platform AI analysis failed on the server. The code was returned unchanged; please check server logs or AI provider configuration.',
    });
  }
});

// Start deployment job
app.post('/api/v1/deploy', (req, res) => {
  const project = req.body as Project & { analysisId?: string };

  if (!project || !project.name || !project.repoUrl) {
    return res
      .status(400)
      .json({ error: 'project.name and project.repoUrl are required' });
  }

  const id = randomUUID();
  const workDirFromAnalysis =
    project.analysisId && analysisSessions.has(project.analysisId)
      ? analysisSessions.get(project.analysisId)!.workDir
      : null;

  deployments.set(id, {
    status: 'IDLE',
    logs: [],
    project,
    workDir: workDirFromAnalysis,
  });

  res.json({ deploymentId: id });

  // Fire and forget async job
  runDeployment(id).catch((err) => {
    console.error('Deployment job failed', err);
  });
});

// Deployment log stream (SSE)
app.get('/api/v1/deployments/:id/stream', (req, res) => {
  const { id } = req.params as { id: string };

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
