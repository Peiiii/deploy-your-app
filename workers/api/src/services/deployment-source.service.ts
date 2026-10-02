import type { ApiWorkerEnv } from '../types/env';
import { ValidationError, ConfigurationError } from '../utils/error-handler';

const MAX_ZIP_BYTES = 75 * 1024 * 1024;
const PREFIX = 'deployment-sources/';

export const deploymentSourceService = {
  async upload(
    env: ApiWorkerEnv,
    projectId: string,
    request: Request
  ): Promise<{ zipSourceKey: string; size: number }> {
    if (!env.ASSETS) throw new ConfigurationError('Deployment storage is unavailable.');
    const size = Number(request.headers.get('content-length'));
    if (!request.body || !Number.isSafeInteger(size) || size <= 0 || size > MAX_ZIP_BYTES) {
      throw new ValidationError(
        'Upload a ZIP file up to 75 MB. Remove node_modules and .git before uploading.'
      );
    }
    const key = `${PREFIX}${new Date().toISOString().slice(0, 10)}/${projectId}/${crypto.randomUUID()}.zip`;
    const stored = await env.ASSETS.put(key, request.body, {
      httpMetadata: { contentType: 'application/zip' },
      customMetadata: { projectId },
    });
    if (!stored || stored.size !== size || stored.size > MAX_ZIP_BYTES) {
      await env.ASSETS.delete(key);
      throw new ValidationError('The ZIP upload was incomplete. Please upload it again.');
    }
    return { zipSourceKey: key, size: stored.size };
  },

  async validate(env: ApiWorkerEnv, projectId: string, key: string): Promise<number> {
    if (
      !env.ASSETS ||
      !new RegExp(`^${PREFIX}\\d{4}-\\d{2}-\\d{2}/${projectId}/[a-f0-9-]{36}\\.zip$`, 'i').test(key)
    ) {
      throw new ValidationError('Invalid ZIP upload reference. Please upload the ZIP again.');
    }
    const object = await env.ASSETS.head(key);
    if (
      !object ||
      object.customMetadata?.projectId !== projectId ||
      object.size <= 0 ||
      object.size > MAX_ZIP_BYTES
    ) {
      throw new ValidationError('The ZIP upload expired or is incomplete. Please upload it again.');
    }
    return object.size;
  },

  async cleanup(env: ApiWorkerEnv): Promise<void> {
    if (!env.ASSETS) return;
    const objects = await env.ASSETS.list({ prefix: PREFIX, limit: 1000 });
    const expired = objects.objects
      .filter((object) => object.uploaded.getTime() < Date.now() - 86400000)
      .map((object) => object.key);
    if (expired.length) await env.ASSETS.delete(expired);
  },
};
