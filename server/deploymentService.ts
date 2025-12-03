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
import { CONFIG } from './config.js';
import type { DeploymentStatus, LogLevel, BuildLog } from './types.js';
import { slugify } from './utils.js';
import { applyFixesForDeployment } from './fixPipeline.js';
import { DEPLOY_TARGET } from './config.js';
import { deployToCloudflarePages } from './cloudflarePagesProvider.js';
import { deployToR2 } from './r2Provider.js';
import AdmZip from 'adm-zip';
import type { Project } from './types.js';

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

// ----------------------
// Source materialization
// ----------------------

// Download a ZIP archive from the given URL and extract it into workDir.
async function downloadAndExtractZip(
  deploymentId: string,
  zipUrl: string,
  workDir: string,
): Promise<void> {
  appendLog(
    deploymentId,
    `Downloading ZIP archive from ${zipUrl}`,
    'info',
  );

  const resp = await fetch(zipUrl);
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(
      `Failed to download ZIP archive: ${resp.status} ${resp.statusText} ${text}`,
    );
  }

  const buffer = Buffer.from(await resp.arrayBuffer());
  const zip = new AdmZip(buffer);
  zip.extractAllTo(workDir, true);

  // For archives like GitHub's, contents are under a single top-level folder.
  // If that is the case, move everything up so that workDir becomes the repo root.
  const entries = await fs.promises.readdir(workDir, { withFileTypes: true });
  if (entries.length === 1 && entries[0].isDirectory()) {
    const innerRoot = path.join(workDir, entries[0].name);
    const innerEntries = await fs.promises.readdir(innerRoot, {
      withFileTypes: true,
    });
    for (const entry of innerEntries) {
      const from = path.join(innerRoot, entry.name);
      const to = path.join(workDir, entry.name);
      await fs.promises.rename(from, to);
    }
    await fs.promises.rmdir(innerRoot);
  }
}

function getGitHubZipUrls(repoUrl: string): string[] {
  let url = repoUrl.trim();
  // Normalize git@github.com:owner/repo.git to https
  if (url.startsWith('git@github.com:')) {
    url = url
      .replace(/^git@github\.com:/, 'https://github.com/')
      .replace(/\.git$/, '');
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(
      `Unsupported repository URL: "${repoUrl}". For now, only GitHub HTTPS URLs are supported.`,
    );
  }

  if (parsed.hostname !== 'github.com') {
    throw new Error(
      `Only GitHub repositories are supported via ZIP download (got host "${parsed.hostname}").`,
    );
  }

  const parts = parsed.pathname.replace(/\.git$/, '').split('/').filter(Boolean);
  if (parts.length < 2) {
    throw new Error(
      `Could not parse GitHub repository from URL "${repoUrl}". Expected https://github.com/<owner>/<repo>.`,
    );
  }

  const owner = parts[0];
  const repo = parts[1];

  // Try main first, then master.
  return [
    `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/main`,
    `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/master`,
  ];
}

async function materializeSourceForDeployment(
  deploymentId: string,
  project: Project,
  workDir: string,
): Promise<void> {
  const sourceType = project.sourceType || 'github';
  const identifier = project.repoUrl;

  // Clear any previous contents for a fresh materialization.
  await fs.promises.rm(workDir, { recursive: true, force: true });
  await fs.promises.mkdir(workDir, { recursive: true });

  if (sourceType === 'zip') {
    if (!/^https?:\/\//i.test(identifier)) {
      throw new Error(
        'For sourceType "zip", project.repoUrl must be an HTTP(s) URL to a .zip file.',
      );
    }
    await downloadAndExtractZip(deploymentId, identifier, workDir);
    return;
  }

  // Default: treat identifier as a GitHub repository URL and download the
  // corresponding codeload ZIP archive.
  const candidates = getGitHubZipUrls(identifier);
  let lastError: unknown = null;
  for (const zipUrl of candidates) {
    try {
      await downloadAndExtractZip(deploymentId, zipUrl, workDir);
      appendLog(
        deploymentId,
        `Repository materialized from ${zipUrl}`,
        'info',
      );
      return;
    } catch (err) {
      lastError = err;
      appendLog(
        deploymentId,
        `Failed to download from ${zipUrl}: ${
          err && (err as Error).message ? (err as Error).message : String(err)
        }`,
        'warning',
      );
    }
  }

  throw new Error(
    `Failed to materialize repository from GitHub ZIP archives. Last error: ${
      lastError && (lastError as Error).message
        ? (lastError as Error).message
        : String(lastError)
    }`,
  );
}

	// Copy a built static directory into the local /apps/<slug>/ folder for
// local preview / hosting by the Node server.
async function deployToLocalStatic(opts: {
  deploymentId: string;
  slug: string;
  distPath: string;
}): Promise<string> {
  const { deploymentId, slug, distPath } = opts;
  const outputDir = path.join(CONFIG.paths.staticRoot, slug);

  appendLog(
    deploymentId,
    `Copying build output to local static dir: ${outputDir}`,
    'info',
  );
  await fs.promises.rm(outputDir, { recursive: true, force: true });
  await copyDir(distPath, outputDir);

  // Local apps are served under /apps/<slug>/ by the Express server.
  return `/apps/${slug}/`;
}

	// Cloudflare Pages deployment is implemented in cloudflarePagesProvider.ts
	// to keep this file focused on the generic deployment pipeline.

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
  options: SpawnOptions = {},
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    appendLog(id, `$ ${command} ${args.join(' ')}`, 'info');

    const child = spawn(command, args, {
      ...options,
      shell: false,
      // Allow callers to override/extend env vars while always inheriting
      // the base process environment.
      env: { ...process.env, ...(options.env || {}) },
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
  const workDir = path.join(CONFIG.paths.buildsRoot, `analysis-${analysisId}`);

  await fs.promises.mkdir(workDir, { recursive: true });

  // Clone the repo into the analysis workdir
  const cloneArgs = ['clone', '--depth=1', repoUrl, workDir];
  await new Promise<void>((resolve, reject) => {
    const child = spawn('git', cloneArgs, {
      cwd: CONFIG.paths.buildsRoot,
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
  const analysisId = project.analysisId;
  const slug = slugify(project.name);

  // Reuse an existing prepared repo when analysis has been run, otherwise create a fresh workdir.
  let workDir = deployment.workDir;
  if (!workDir) {
    workDir = path.join(CONFIG.paths.buildsRoot, id);
    deployment.workDir = workDir;
  }

  const isFromAnalysis =
    Boolean(analysisId) &&
    analysisSessions.has(analysisId!) &&
    deployment.workDir === analysisSessions.get(analysisId!)!.workDir;

  try {
    updateStatus(id, 'BUILDING');
    appendLog(id, `Starting deployment for "${project.name}"`, 'info');

    // If this deployment reuses a prepared repository from an analysis session,
    // keep that workdir as-is. Otherwise, materialize the source into workDir
    // by downloading a ZIP archive (GitHub codeload or direct .zip URL).
    if (isFromAnalysis) {
      appendLog(id, `Reusing prepared repository at ${workDir}`, 'info');
    } else {
      await materializeSourceForDeployment(id, project, workDir);
    }

    // Apply repository-level fixes (like injecting missing entry scripts)
    // before installing dependencies and building.
    await applyFixesForDeployment(id, workDir);

    appendLog(id, 'Installing dependencies with npm', 'info');
    await runCommand(id, 'npm', ['install'], {
      cwd: workDir,
      // Ensure devDependencies (like Vite) are always installed, even if
      // the server runs with NODE_ENV=production or npm_config_production=true.
      env: {
        npm_config_production: 'false',
      },
    });

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

    // Decide deployment target: prefer project-level setting, otherwise fall
    // back to global default.
    const target = project.deployTarget || DEPLOY_TARGET;

    updateStatus(id, 'DEPLOYING');

    let finalUrl: string;
    let providerUrl: string | undefined;
    let cloudflareProjectName: string | undefined;

    if (target === 'cloudflare') {
      const result = await deployToCloudflarePages({
        slug,
        distPath,
        log: (message, level = 'info') => appendLog(id, message, level),
      });
      finalUrl = result.publicUrl;
      providerUrl = result.providerUrl;
      cloudflareProjectName = result.projectName;
    } else if (target === 'r2') {
      const result = await deployToR2({
        slug,
        distPath,
        deploymentId: id,
        log: (message, level = 'info') => appendLog(id, message, level),
      });
      finalUrl = result.publicUrl;
      // For debugging: show where in R2 this deployment lives.
      providerUrl = `r2://${result.storagePrefix}`;
    } else {
      finalUrl = await deployToLocalStatic({
        deploymentId: id,
        slug,
        distPath,
      });
    }

    // Update project metadata with the final URLs.
    project.url = finalUrl;
    project.deployTarget = target;
    if (providerUrl) {
      project.providerUrl = providerUrl;
    }
    if (cloudflareProjectName) {
      project.cloudflareProjectName = cloudflareProjectName;
    }

    appendLog(
      id,
      `Deployment complete. App is available at ${finalUrl}`,
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
