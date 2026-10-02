import * as fs from 'fs';
import * as path from 'path';
import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
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
} from '../../../common/config/config.js';
import type { LogLevel } from '../../../common/types.js';

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
        try { await client.send(
          new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: body,
            ContentType: contentType,
            CacheControl: cacheControl,
          }),
        ); } finally { body.destroy(); }
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
  const { slug, distPath, deploymentId, log } = opts;
  ensureR2Config();
  if (!/^[a-z0-9-]{1,63}$/.test(slug) || !/^[a-f0-9-]{36}$/i.test(deploymentId)) throw new Error('Invalid publication identity.');
  const client = createR2Client();
  const bucketName = R2_BUCKET_NAME;
  const prefix = `apps/${slug}/releases/${deploymentId}`;
  const pointerKey = `apps/${slug}/deployment.json`;
  let active: { prefix: string; previousPrefix?: string } = { prefix: `apps/${slug}/current` };
  let activated = false;
  let activationUncertain = false;
  try {
    try {
      const pointer = await client.send(new GetObjectCommand({ Bucket: bucketName, Key: pointerKey }));
      active = JSON.parse(await pointer.Body!.transformToString());
    } catch (error) {
      if ((error as { name?: string }).name !== 'NoSuchKey' && (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode !== 404) throw error;
    }
    log('Uploading a complete new version before switching the live site.', 'info');
    await uploadDirectoryToR2({ client, bucketName, localDir: distPath, prefix, log });
    activationUncertain = true;
    try {
      await client.send(new PutObjectCommand({
      Bucket: bucketName, Key: pointerKey,
      Body: JSON.stringify({ prefix, previousPrefix: active.prefix }),
      ContentType: 'application/json', CacheControl: 'no-cache',
      }));
    } catch (error) {
      // A network error can happen after the pointer was written. Confirm before cleanup.
      try {
        const pointer = await client.send(new GetObjectCommand({ Bucket: bucketName, Key: pointerKey }));
        activated = JSON.parse(await pointer.Body!.transformToString()).prefix === prefix;
        activationUncertain = false;
      } catch (confirmationError) {
        if ((confirmationError as { name?: string }).name === 'NoSuchKey') activationUncertain = false;
      }
      if (!activated) throw error;
    }
    activated = true;
    // Keep the immediately preceding version, including hashed assets used by open tabs.
    if (active.previousPrefix && active.previousPrefix !== active.prefix && active.previousPrefix.startsWith(`apps/${slug}/releases/`)) {
      await clearPrefix(client, bucketName, `${active.previousPrefix}/`, log).catch(() => log('Previous version cleanup will be retried on a later deployment.', 'warning'));
    }
    const publicUrl = `https://${slug}.${APPS_ROOT_DOMAIN}/`;
    log(`R2 deployment completed. App is available at ${publicUrl}`, 'success');
    return { publicUrl, storagePrefix: prefix };
  } catch (error) {
    if (!activated && !activationUncertain) await clearPrefix(client, bucketName, `${prefix}/`, log).catch(() => {});
    throw error;
  } finally { client.destroy(); }
}

// Temporary ZIP sources share the already configured R2 bucket and credentials.
export async function consumeDeploymentSource(key: string): Promise<Buffer> {
  if (!/^deployment-sources\/\d{4}-\d{2}-\d{2}\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.zip$/i.test(key)) {
    throw Object.assign(new Error('Invalid uploaded ZIP reference.'), { code: 'invalid_source' });
  }
  ensureR2Config();
  const client = createR2Client();
  try {
    const object = await client.send(new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }), { abortSignal: AbortSignal.timeout(60000) });
    if (!object.Body || !object.ContentLength || object.ContentLength > 75 * 1024 * 1024) {
      throw Object.assign(new Error('ZIP source is missing or exceeds 75 MB.'), { code: 'invalid_source' });
    }
    return Buffer.from(await object.Body.transformToByteArray());
  } finally {
    await client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key })).catch(() => {});
    client.destroy();
  }
}
