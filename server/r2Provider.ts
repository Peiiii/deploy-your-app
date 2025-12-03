import * as fs from 'fs';
import * as path from 'path';
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import {
  APPS_ROOT_DOMAIN,
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_BUCKET_NAME,
  R2_SECRET_ACCESS_KEY,
} from './config.js';
import type { LogLevel } from './types.js';

export type LogFn = (message: string, level?: LogLevel) => void;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureR2Config(): void {
  if (!R2_ACCOUNT_ID) {
    throw new Error(
      'R2 account id not configured. Please set R2_ACCOUNT_ID or CLOUDFLARE_ACCOUNT_ID.',
    );
  }
  if (!R2_BUCKET_NAME) {
    throw new Error(
      'R2 bucket name not configured. Please set R2_BUCKET_NAME.',
    );
  }
  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error(
      'R2 credentials not configured. Please set R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY.',
    );
  }
}

function createR2Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

// Basic content type detection for common static asset extensions.
function getContentType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.html')) return 'text/html; charset=utf-8';
  if (lower.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (lower.endsWith('.mjs')) return 'application/javascript; charset=utf-8';
  if (lower.endsWith('.css')) return 'text/css; charset=utf-8';
  if (lower.endsWith('.json')) return 'application/json; charset=utf-8';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.ico')) return 'image/x-icon';
  return 'application/octet-stream';
}

function getCacheControl(fileName: string): string {
  const lower = fileName.toLowerCase();
  // HTML / JSON should revalidate quickly so new deployments are visible.
  if (lower.endsWith('.html') || lower.endsWith('.json')) {
    return 'no-cache';
  }
  // Static assets (JS/CSS/images) can be cached aggressively.
  return 'public, max-age=31536000, immutable';
}

async function clearPrefix(
  client: S3Client,
  bucketName: string,
  prefix: string,
  log: LogFn,
): Promise<void> {
  let continuationToken: string | undefined;

  for (;;) {
    const listResp = await client.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    const contents = listResp.Contents ?? [];
    if (contents.length === 0) {
      break;
    }

    const toDelete = contents
      .map((obj) => obj.Key)
      .filter((key): key is string => typeof key === 'string');
    if (toDelete.length > 0) {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucketName,
          Delete: {
            Objects: toDelete.map((Key) => ({ Key })),
            Quiet: true,
          },
        }),
      );
      log(
        `Cleared ${toDelete.length} objects from R2 prefix "${prefix}"`,
        'info',
      );
    }

    if (!listResp.IsTruncated) break;
    continuationToken = listResp.NextContinuationToken;
  }
}

async function uploadDirectoryToR2(opts: {
  client: S3Client;
  bucketName: string;
  localDir: string;
  prefix: string;
  log: LogFn;
}): Promise<void> {
  const { client, bucketName, localDir, prefix, log } = opts;

  async function walk(currentRel: string): Promise<void> {
    const full = path.join(localDir, currentRel);
    const entries = await fs.promises.readdir(full, { withFileTypes: true });
    for (const entry of entries) {
      const relPath = path.join(currentRel, entry.name);
      const fullPath = path.join(localDir, relPath);

      if (entry.isDirectory()) {
        await walk(relPath);
      } else if (entry.isFile()) {
        // Normalize key so that there is no leading "./"
        const normalizedRel = relPath.replace(/^[\\/]+/, '').replace(/\\/g, '/');
        const key =
          prefix.endsWith('/')
            ? `${prefix}${normalizedRel}`
            : `${prefix}/${normalizedRel}`;

        const contentType = getContentType(entry.name);
        const cacheControl = getCacheControl(entry.name);

        log(`Uploading ${normalizedRel} -> r2://${bucketName}/${key}`, 'info');

        const body = fs.createReadStream(fullPath);
        await client.send(
          new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: body,
            ContentType: contentType,
            CacheControl: cacheControl,
          }),
        );
      }
    }
  }

  await walk('');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function deployToR2(opts: {
  slug: string;
  distPath: string;
  deploymentId: string;
  log: LogFn;
}): Promise<{
  publicUrl: string;
  storagePrefix: string;
}> {
  const { slug, distPath, log } = opts;

  ensureR2Config();

  const client = createR2Client();
  const bucketName = R2_BUCKET_NAME;

  // For now, we keep a single "current" version per app. All files for the app
  // live under this prefix. In the future we can extend this to include
  // deployment ids for instant rollbacks, e.g. apps/<slug>/<deploymentId>/...
  const prefix = `apps/${slug}/current`;

  log(
    `Deploying static assets to R2 bucket "${bucketName}" under prefix "${prefix}"`,
    'info',
  );

  // Best-effort cleanup of previous contents for this app.
  await clearPrefix(client, bucketName, `${prefix}/`, log);

  // Upload fresh build output.
  await uploadDirectoryToR2({
    client,
    bucketName,
    localDir: distPath,
    prefix,
    log,
  });

  // The final public URL is served via the Cloudflare Worker gateway that
  // routes *.APPS_ROOT_DOMAIN to this R2 bucket.
  const publicUrl = `https://${slug}.${APPS_ROOT_DOMAIN}/`;

  log(
    `R2 deployment completed. App will be served at ${publicUrl}`,
    'info',
  );

  // We return the storage prefix mainly for debugging/observability.
  return {
    publicUrl,
    storagePrefix: prefix,
  };
}
