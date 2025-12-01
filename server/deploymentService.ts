import { randomUUID } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, SpawnOptions } from 'child_process';
import JSZip from 'jszip';
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
import {
  DEPLOY_TARGET,
  CLOUDFLARE_PAGES_PROJECT_PREFIX,
  CLOUDFLARE_ACCOUNT_ID,
  CLOUDFLARE_API_TOKEN,
} from './config.js';

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

// Copy a built static directory into the local /apps/<slug>/ folder for
// local preview / hosting by the Node server.
async function deployToLocalStatic(opts: {
  deploymentId: string;
  slug: string;
  distPath: string;
}): Promise<string> {
  const { deploymentId, slug, distPath } = opts;
  const outputDir = path.join(staticRoot, slug);

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

// Recursively add all files under "dir" into an in-memory ZIP archive.
async function zipDirectoryToBuffer(dir: string): Promise<Buffer> {
  const zip = new JSZip();

  async function addDir(relative: string): Promise<void> {
    const full = path.join(dir, relative);
    const entries = await fs.promises.readdir(full, { withFileTypes: true });
    for (const entry of entries) {
      const relPath = path.join(relative, entry.name);
      const fullPath = path.join(dir, relPath);
      if (entry.isDirectory()) {
        await addDir(relPath);
      } else if (entry.isFile()) {
        const data = await fs.promises.readFile(fullPath);
        // Use forward slashes for ZIP paths.
        const zipPath = relPath.replace(/\\/g, '/');
        zip.file(zipPath, data);
      }
    }
  }

  await addDir('');

  // Generate a Node.js Buffer with reasonable compression.
  const buffer = (await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })) as Buffer;

  return buffer;
}

// Ensure a Cloudflare Pages project exists (idempotent).
async function ensureCloudflarePagesProject(
  deploymentId: string,
  projectName: string,
): Promise<void> {
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
    throw new Error(
      'Cloudflare account id/token not configured. Please set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in your environment.',
    );
  }

  const baseUrl = 'https://api.cloudflare.com/client/v4';
  const projectUrl = `${baseUrl}/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${projectName}`;

  // Try to fetch the project; if it exists, we're done.
  let resp;
  try {
    resp = await fetch(projectUrl, {
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
  } catch (err) {
    throw new Error(
      `Failed to query Cloudflare Pages project "${projectName}": ${String(
        err,
      )}`,
    );
  }

  if (resp.ok) {
    return;
  }

  if (resp.status !== 404) {
    const text = await resp.text().catch(() => '');
    throw new Error(
      `Cloudflare API error while checking project "${projectName}": ${resp.status} ${resp.statusText} ${text}`,
    );
  }

  // Project not found → create it.
  const createUrl = `${baseUrl}/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects`;
  appendLog(
    deploymentId,
    `Creating Cloudflare Pages project "${projectName}" via API`,
    'info',
  );

  const body = {
    name: projectName,
    production_branch: 'main',
    build_config: {
      build_command: '',
      destination_dir: '',
      root_dir: '',
    },
  };

  let createResp;
  try {
    createResp = await fetch(createUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(
      `Failed to create Cloudflare Pages project "${projectName}": ${String(
        err,
      )}`,
    );
  }

  if (!createResp.ok) {
    const text = await createResp.text().catch(() => '');
    throw new Error(
      `Cloudflare API error while creating project "${projectName}": ${createResp.status} ${createResp.statusText} ${text}`,
    );
  }
}

// Deploy a built static directory to Cloudflare Pages using the HTTP API
// (direct upload), without relying on the Cloudflare CLI.
async function deployToCloudflarePages(opts: {
  deploymentId: string;
  slug: string;
  distPath: string;
}): Promise<{
  publicUrl: string;
  providerUrl: string;
  projectName: string;
}> {
  const { deploymentId, slug, distPath } = opts;

  const prefix = CLOUDFLARE_PAGES_PROJECT_PREFIX || 'deploy-your-app';
  const projectName = `${prefix}-${slug}`.toLowerCase();

  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
    throw new Error(
      'Cloudflare account id/token not configured. Please set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in your environment.',
    );
  }

  appendLog(
    deploymentId,
    `Preparing Cloudflare Pages deployment for project "${projectName}" from ${distPath}`,
    'info',
  );

  // Ensure the Pages project exists (idempotent).
  await ensureCloudflarePagesProject(deploymentId, projectName);

  appendLog(
    deploymentId,
    `Zipping build output directory for Cloudflare upload...`,
    'info',
  );

  const zipBuffer = await zipDirectoryToBuffer(distPath);

  const apiBase = 'https://api.cloudflare.com/client/v4';
  const deployUrl = `${apiBase}/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${projectName}/deployments`;

  appendLog(
    deploymentId,
    `Uploading deployment to Cloudflare Pages via API (${deployUrl})`,
    'info',
  );

  let resp;
  try {
    // We send the ZIP file as the request body. Cloudflare interprets this
    // as a direct-upload deployment for the given project.
    resp = await fetch(deployUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/zip',
      },
      // Buffer is accepted by Node's fetch implementation as a body.
      body: zipBuffer,
    });
  } catch (err) {
    throw new Error(
      `Failed to upload deployment to Cloudflare Pages: ${String(err)}`,
    );
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(
      `Cloudflare API error while creating deployment: ${resp.status} ${resp.statusText} ${text}`,
    );
  }

  const providerUrl = `https://${projectName}.pages.dev/`;
  const publicUrl = providerUrl;

  appendLog(
    deploymentId,
    `Cloudflare Pages deployment successful: ${providerUrl}`,
    'info',
  );

  return { publicUrl, providerUrl, projectName };
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

    // Decide deployment target: prefer project-level setting, otherwise fall
    // back to global default.
    const target = project.deployTarget || DEPLOY_TARGET;

    updateStatus(id, 'DEPLOYING');

    let finalUrl: string;
    let providerUrl: string | undefined;
    let cloudflareProjectName: string | undefined;

    if (target === 'cloudflare') {
      const result = await deployToCloudflarePages({
        deploymentId: id,
        slug,
        distPath,
      });
      finalUrl = result.publicUrl;
      providerUrl = result.providerUrl;
      cloudflareProjectName = result.projectName;
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
