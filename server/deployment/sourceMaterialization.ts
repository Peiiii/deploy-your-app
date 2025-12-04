import * as path from 'path';
import * as fs from 'fs';
import AdmZip from 'adm-zip';
import { deployments } from '../state.js';
import type { Project } from '../types.js';
import { appendLog } from './deploymentEvents.js';

async function extractZipBufferToWorkDir(
  buffer: Buffer,
  workDir: string,
): Promise<void> {
  const zip = new AdmZip(buffer);
  zip.extractAllTo(workDir, true);

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
  await extractZipBufferToWorkDir(buffer, workDir);
}

function getGitHubZipUrls(repoUrl: string): string[] {
  let url = repoUrl.trim();
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

  return [
    `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/main`,
    `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/master`,
  ];
}

export async function materializeSourceForDeployment(
  deploymentId: string,
  project: Project,
  workDir: string,
): Promise<void> {
  const sourceType = project.sourceType || 'github';
  const identifier = project.repoUrl;

  await fs.promises.rm(workDir, { recursive: true, force: true });
  await fs.promises.mkdir(workDir, { recursive: true });

  if (sourceType === 'zip') {
    const deploymentRecord = deployments.get(deploymentId);
    const zipData = deploymentRecord?.zipData;

    if (zipData) {
      appendLog(
        deploymentId,
        'Using uploaded ZIP archive provided by the client.',
        'info',
      );
      let base64 = zipData.trim();
      const commaIndex = base64.indexOf(',');
      if (base64.startsWith('data:') && commaIndex >= 0) {
        base64 = base64.slice(commaIndex + 1);
      }
      const buffer = Buffer.from(base64, 'base64');
      await extractZipBufferToWorkDir(buffer, workDir);
      return;
    }

    if (!/^https?:\/\//i.test(identifier)) {
      throw new Error(
        'For sourceType "zip", project.repoUrl must be an HTTP(s) URL to a .zip file.',
      );
    }
    await downloadAndExtractZip(deploymentId, identifier, workDir);
    return;
  }

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

