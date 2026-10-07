import type { ApiWorkerEnv } from '../types/env';
import { ConfigurationError } from '../utils/error-handler';

export const deploymentStorage = {
  bucket(env: ApiWorkerEnv): R2Bucket {
    if (!env.ASSETS) throw new ConfigurationError('Deployment storage is unavailable.');
    return env.ASSETS;
  },

  async clear(bucket: R2Bucket, prefix: string): Promise<void> {
    let cursor: string | undefined;
    do {
      const page = await bucket.list({ prefix, cursor, limit: 1000 });
      if (page.objects.length) await bucket.delete(page.objects.map(object => object.key));
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
  },

  async prune(env: ApiWorkerEnv, slug: string): Promise<void> {
    const bucket: R2Bucket = this.bucket(env), root = `apps/${slug}/`;
    const object = await bucket.get(`${root}deployment.json`);
    const pointer = object ? await object.json<{ prefix: string; previousPrefix?: string }>() : { prefix: `${root}current` };
    const valid = (prefix: string) => prefix === `${root}current` || new RegExp(`^apps/${slug}/releases/[a-f0-9-]{36}$`, 'i').test(prefix);
    if (!valid(pointer.prefix) || (pointer.previousPrefix && !valid(pointer.previousPrefix))) throw new Error('Unsafe deployment pointer.');
    const keep = new Set([pointer.prefix, pointer.previousPrefix]);
    let cursor: string | undefined;
    do {
      const page = await bucket.list({ prefix: `${root}releases/`, delimiter: '/', cursor });
      for (const prefix of page.delimitedPrefixes) {
        if (!keep.has(prefix.slice(0, -1))) await this.clear(bucket, prefix);
      }
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    if (!keep.has(`${root}current`)) await this.clear(bucket, `${root}current/`);
  },

  async deleteProject(env: ApiWorkerEnv, slug: string, projectId: string): Promise<void> {
    if (!/^[a-z0-9-]{1,63}$/.test(slug) || !/^[a-f0-9-]{36}$/i.test(projectId)) throw new Error('Invalid storage identity.');
    const bucket = this.bucket(env);
    await this.clear(bucket, `apps/${slug}/`);
    let cursor: string | undefined;
    do {
      const page = await bucket.list({ prefix: 'deployment-sources/', delimiter: '/', cursor });
      for (const prefix of page.delimitedPrefixes) {
        if (/^deployment-sources\/\d{4}-\d{2}-\d{2}\/$/.test(prefix)) await this.clear(bucket, `${prefix}${projectId}/`);
      }
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
  },
};

export const assetMetadata = (file: string): R2HTTPMetadata => {
  const extension = file.split('.').pop()?.toLowerCase();
  const types: Record<string, string> = { html: 'text/html; charset=utf-8', js: 'application/javascript; charset=utf-8', mjs: 'application/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json; charset=utf-8', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp', ico: 'image/x-icon', wasm: 'application/wasm', woff: 'font/woff', woff2: 'font/woff2', mp3: 'audio/mpeg', mp4: 'video/mp4', pdf: 'application/pdf' };
  return { contentType: types[extension || ''] || 'application/octet-stream', cacheControl: ['html', 'json'].includes(extension || '') ? 'no-cache' : 'public, max-age=31536000, immutable' };
};
