import * as path from 'path';
import * as fs from 'fs';
import AdmZip from 'adm-zip';
import { consumeDeploymentSource } from '../providers/r2Provider.js';
import { deployments } from '../state.js';
import type { Project } from '../../../common/types.js';
import { SourceType } from '../../../common/types.js';
import { appendLog } from './deploymentEvents.js';

async function extractZipBufferToWorkDir(
  buffer: Buffer,
  workDir: string,
): Promise<void> {
  const zip = new AdmZip(buffer);
  let unpackedBytes = 0;
  const zipEntries = zip.getEntries();
  if (zipEntries.length > 10000) throw Object.assign(new Error('ZIP contains too many files. Remove node_modules and .git before uploading.'), { code: 'archive_too_large' });
  for (const entry of zipEntries) {
    const name = entry.entryName.replaceAll('\\', '/');
    if (name.startsWith('/') || name.split('/').includes('..') || /^[a-z]:/i.test(name)) {
      throw Object.assign(new Error('ZIP contains an unsafe file path.'), { code: 'invalid_archive' });
    }
    unpackedBytes += entry.header.size;
    if (unpackedBytes > 500 * 1024 * 1024) throw Object.assign(new Error('ZIP expands beyond 500 MB. Remove node_modules and .git.'), { code: 'archive_too_large' });
    if (name.split('/').some(part => ['__MACOSX', '.DS_Store', 'node_modules', '.git'].includes(part))) zip.deleteFile(entry);
  }
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

  const resp = await fetch(zipUrl, { signal: AbortSignal.timeout(60000) });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(
      `Failed to download ZIP archive: ${resp.status} ${resp.statusText} ${text}`,
    );
  }

  if (!resp.body) throw new Error('Archive download returned an empty body.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = resp.body.getReader();
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 75 * 1024 * 1024) throw Object.assign(new Error('Repository ZIP exceeds 75 MB. Upload only the source or built static folder.'), { code: 'archive_too_large' });
      chunks.push(chunk.value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  await extractZipBufferToWorkDir(Buffer.concat(chunks), workDir);
}

async function getGitHubZipUrls(repoUrl: string): Promise<string[]> {
  let url = repoUrl.trim().replace(/^git@github\.com:/, 'https://github.com/');
  if (/^github\.com\//i.test(url)) url = `https://${url}`;
  let parsed: URL;
  try { parsed = new URL(url); } catch {
    throw Object.assign(new Error('Enter a GitHub repository URL such as https://github.com/owner/repo.'), { code: 'invalid_repository' });
  }
  const parts = parsed.pathname.split('/').filter(Boolean);
  if (parsed.hostname !== 'github.com' || parts.length < 2 || !['http:', 'https:'].includes(parsed.protocol)) {
    throw Object.assign(new Error('Only public GitHub repositories are supported. Enter https://github.com/owner/repo.'), { code: 'invalid_repository' });
  }
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/, '');
  const api = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
    headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'GemiGo-deployment' },
    signal: AbortSignal.timeout(10000),
  });
  if (!api.ok) {
    const message = api.status === 404
      ? 'GitHub repository was not found or is private. Use a public repository or upload its ZIP.'
      : api.status === 403 || api.status === 429 ? 'GitHub temporarily limited downloads. Try again later or upload a ZIP.' : 'Could not read the GitHub repository. Please try again.';
    throw Object.assign(new Error(message), { code: api.status === 404 ? 'repository_unavailable' : 'repository_download_failed' });
  }
  const metadata = await api.json() as { default_branch?: string };
  const branch = parts[2] === 'tree' ? decodeURIComponent(parts.slice(3).join('/')) : metadata.default_branch;
  if (!branch) throw Object.assign(new Error('GitHub repository has no branch to deploy.'), { code: 'repository_unavailable' });
  return [`https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${encodeURIComponent(branch)}`];
}

export async function materializeSourceForDeployment(
  deploymentId: string,
  project: Project,
  workDir: string,
): Promise<void> {
  const sourceType = project.sourceType ?? SourceType.GitHub;
  const identifier = project.repoUrl;

  await fs.promises.rm(workDir, { recursive: true, force: true });
  await fs.promises.mkdir(workDir, { recursive: true });

  if (sourceType === SourceType.Html) {
    const htmlContent = project.htmlContent;
    if (!htmlContent || htmlContent.trim().length === 0) {
      throw new Error(
        'No HTML content provided for sourceType "html". Please supply inline HTML.',
      );
    }
    const fullPath = path.join(workDir, 'index.html');
    await fs.promises.writeFile(fullPath, htmlContent, 'utf8');
    appendLog(
      deploymentId,
      'Materialized inline HTML into index.html',
      'info',
    );
    return;
  }

  if (sourceType === SourceType.Zip) {
    const deploymentRecord = deployments.get(deploymentId);
    if (deploymentRecord?.zipSourceKey) {
      appendLog(deploymentId, 'Downloading the uploaded ZIP from temporary storage.', 'info');
      await extractZipBufferToWorkDir(await consumeDeploymentSource(deploymentRecord.zipSourceKey), workDir);
      return;
    }
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

  const candidates = await getGitHubZipUrls(identifier);
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

  throw lastError;
}
