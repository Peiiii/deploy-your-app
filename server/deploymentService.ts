import { randomUUID } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, SpawnOptions } from 'child_process';
import {
  deployments,
  analysisSessions,
  streams,
  type StreamClient,
} from './state.js';
import { buildsRoot, staticRoot } from './paths.js';
import type { DeploymentStatus, LogLevel, BuildLog } from './types.js';
import { slugify } from './utils.js';
import { applyFixesForDeployment } from './fixPipeline.js';

// Broadcast an event payload to all SSE clients for a given deployment id.
export function broadcastEvent(id: string, payload: unknown): void {
  const listeners = streams.get(id);
  if (!listeners) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of listeners as Set<StreamClient>) {
    res.write(data);
  }
}

export function appendLog(
  id: string,
  message: string,
  level: LogLevel = 'info',
): void {
  const deployment = deployments.get(id);
  if (!deployment) return;
  const timestamp = new Date().toISOString();
  const logEntry: BuildLog = { timestamp, message, level };
  deployment.logs.push(logEntry);
  broadcastEvent(id, { type: 'log', message, level });
}

export function updateStatus(id: string, status: DeploymentStatus): void {
  const deployment = deployments.get(id);
  if (!deployment) return;
  deployment.status = status;
  broadcastEvent(id, { type: 'status', status });
}

export async function copyDir(src: string, dest: string): Promise<void> {
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

export function runCommand(
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
export async function findAIClientFile(
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

export async function prepareAnalysisSession(repoUrl: string): Promise<{
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

export async function runDeployment(id: string): Promise<void> {
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

    // Apply repository-level fixes (like injecting missing entry scripts)
    // before installing dependencies and building.
    await applyFixesForDeployment(id, workDir);

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

    // Apply post-build fixes that operate on the output bundle (e.g. adjusting
    // asset paths for local preview).
    await applyFixesForDeployment(id, workDir, distPath);

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
