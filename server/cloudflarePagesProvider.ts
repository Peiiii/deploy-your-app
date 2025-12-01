import * as fs from 'fs';
import * as path from 'path';
import { hash as blake3hash } from 'blake3-wasm';
import {
  CLOUDFLARE_ACCOUNT_ID,
  CLOUDFLARE_API_TOKEN,
  CLOUDFLARE_PAGES_PROJECT_PREFIX,
} from './config.js';
import type { LogLevel } from './types.js';

export type LogFn = (message: string, level?: LogLevel) => void;

// Minimal description of a static file in the built output directory.
type StaticFile = {
  relativePath: string;
  fullPath: string;
  contentType: string;
  sizeInBytes: number;
  hash: string;
  data: Buffer;
};

// Basic content type detection for common static asset extensions.
function getContentType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.html')) return 'text/html';
  if (lower.endsWith('.js')) return 'application/javascript';
  if (lower.endsWith('.mjs')) return 'application/javascript';
  if (lower.endsWith('.css')) return 'text/css';
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.ico')) return 'image/x-icon';
  return 'application/octet-stream';
}

// Collect all static files under a directory, computing a hash for each.
async function collectStaticFiles(rootDir: string): Promise<StaticFile[]> {
  const files: StaticFile[] = [];

  async function walk(relative: string): Promise<void> {
    const full = path.join(rootDir, relative);
    const entries = await fs.promises.readdir(full, { withFileTypes: true });
    for (const entry of entries) {
      const relPath = path.join(relative, entry.name);
      const fullPath = path.join(rootDir, relPath);
      if (entry.isDirectory()) {
        await walk(relPath);
      } else if (entry.isFile()) {
        const data = await fs.promises.readFile(fullPath);
        const base64Contents = data.toString('base64');
        const ext = path.extname(fullPath).slice(1);
        // Match Wrangler's hash algorithm so that the Pages asset store and
        // manifest are consistent with the official tooling.
        const hash = Buffer.from(
          blake3hash(base64Contents + ext),
        ).toString('hex').slice(0, 32);
        const sizeInBytes = data.length;
        files.push({
          relativePath: relPath.replace(/\\/g, '/'),
          fullPath,
          contentType: getContentType(entry.name),
          sizeInBytes,
          hash,
          data,
        });
      }
    }
  }

  await walk('');
  return files;
}

// Ensure a Cloudflare Pages project exists (idempotent).
async function ensureCloudflarePagesProject(
  projectName: string,
  log: LogFn,
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
  log(`Creating Cloudflare Pages project "${projectName}" via API`, 'info');

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

// Upload static assets for a Pages project and return the manifest mapping
// "/path" -> hash, following the same shape that wrangler uses.
async function uploadAssetsAndGetManifest(
  projectName: string,
  distPath: string,
  log: LogFn,
): Promise<Record<string, string>> {
  const apiBase = 'https://api.cloudflare.com/client/v4';

  const files = await collectStaticFiles(distPath);
  if (files.length === 0) {
    throw new Error(
      `No files found in build output directory "${distPath}" to upload to Cloudflare Pages.`,
    );
  }

  log(
    `Preparing to upload ${files.length} assets to Cloudflare Pages...`,
    'info',
  );

  // Step 1: get an upload JWT for this Pages project.
  const uploadTokenUrl = `${apiBase}/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${projectName}/upload-token`;
  let jwt: string;
  try {
    const resp = await fetch(uploadTokenUrl, {
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(
        `Cloudflare API error while fetching upload token: ${resp.status} ${resp.statusText} ${text}`,
      );
    }
    const data = (await resp.json()) as {
      result?: { jwt?: string };
      jwt?: string;
    };
    const tokenFromRoot =
      typeof data.jwt === 'string' ? data.jwt : undefined;
    const tokenFromResult =
      data.result && typeof data.result.jwt === 'string'
        ? data.result.jwt
        : undefined;
    jwt = tokenFromRoot || tokenFromResult || '';
    if (!jwt) {
      throw new Error(
        `Cloudflare upload-token response missing "jwt" (raw=${JSON.stringify(
          data,
        )})`,
      );
    }
  } catch (err) {
    throw new Error(
      `Failed to obtain Cloudflare Pages upload token: ${String(err)}`,
    );
  }

  // Step 2: ask which hashes are missing.
  const hashes = files.map((f) => f.hash);
  let missingHashes: string[];
  try {
    const resp = await fetch(`${apiBase}/pages/assets/check-missing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ hashes }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(
        `Cloudflare API error while checking missing assets: ${resp.status} ${resp.statusText} ${text}`,
      );
    }
    const data = (await resp.json()) as {
      result?: unknown;
    };
    const arr =
      Array.isArray(data)
        ? data
        : Array.isArray(data.result)
          ? data.result
          : [];
    missingHashes = arr as string[];
  } catch (err) {
    throw new Error(
      `Failed to check which assets are missing in Cloudflare Pages: ${String(
        err,
      )}`,
    );
  }

  const filesToUpload = files.filter((f) => missingHashes.includes(f.hash));
  log(
    `Assets to upload: ${filesToUpload.length} (skipping ${
      files.length - filesToUpload.length
    } already present)`,
    'info',
  );

  // Step 3: upload missing assets in a single batch.
  if (filesToUpload.length > 0) {
    type UploadPayloadFile = {
      key: string;
      value: string;
      metadata: { contentType: string };
      base64: true;
    };

    const payload: UploadPayloadFile[] = filesToUpload.map((file) => ({
      key: file.hash,
      value: file.data.toString('base64'),
      metadata: { contentType: file.contentType },
      base64: true as const,
    }));

    try {
      const resp = await fetch(`${apiBase}/pages/assets/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(
          `Cloudflare API error while uploading assets: ${resp.status} ${resp.statusText} ${text}`,
        );
      }
    } catch (err) {
      throw new Error(
        `Failed to upload assets to Cloudflare Pages: ${String(err)}`,
      );
    }
  }

  // Step 4: upsert hashes so future builds can reuse cached assets.
  try {
    await fetch(`${apiBase}/pages/assets/upsert-hashes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ hashes }),
    });
  } catch {
    // Non-fatal: wrangler also treats this as best-effort.
    log(
      'Warning: failed to upsert asset hashes; future uploads may be slower.',
      'warning',
    );
  }

  // Step 5: build the manifest mapping "/path" -> hash.
  const manifest: Record<string, string> = {};
  for (const file of files) {
    const key = `/${file.relativePath}`;
    manifest[key] = file.hash;
  }

  return manifest;
}

export async function deployToCloudflarePages(opts: {
  slug: string;
  distPath: string;
  log: LogFn;
}): Promise<{
  publicUrl: string;
  providerUrl: string;
  projectName: string;
}> {
  const { slug, distPath, log } = opts;

  const prefix = CLOUDFLARE_PAGES_PROJECT_PREFIX || 'deploy-your-app';
  const projectName = `${prefix}-${slug}`.toLowerCase();

  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
    throw new Error(
      'Cloudflare account id/token not configured. Please set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in your environment.',
    );
  }

  log(
    `Preparing Cloudflare Pages deployment for project "${projectName}" from ${distPath}`,
    'info',
  );

  // Ensure the Pages project exists (idempotent).
  await ensureCloudflarePagesProject(projectName, log);

  // Upload assets and obtain the manifest mapping "/path" -> hash.
  const manifest = await uploadAssetsAndGetManifest(
    projectName,
    distPath,
    log,
  );

  // Prepare multipart/form-data body for the deployment request.
  // FormData is available in the Node.js runtime via undici, but not typed in
  // our server TS lib, so we access it through globalThis.
  const FormDataCtor = (globalThis as unknown as { FormData: new () => unknown })
    .FormData;
  const formData = new FormDataCtor() as unknown as FormData;
  formData.append('manifest', JSON.stringify(manifest));

  const apiBase = 'https://api.cloudflare.com/client/v4';
  const deployUrl = `${apiBase}/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${projectName}/deployments`;

  log(
    `Uploading deployment to Cloudflare Pages via API (${deployUrl})`,
    'info',
  );

  let resp;
  try {
    resp = await fetch(deployUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
      body: formData,
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

  log(
    `Cloudflare Pages deployment successful: ${providerUrl}`,
    'info',
  );

  return { publicUrl, providerUrl, projectName };
}
