import assert from 'node:assert/strict';
import gateway from '../workers/r2-gateway/worker';
import thumbnailUrlModule from '../frontend/src/utils/thumbnail-url.ts';

const { getProjectThumbnailUrl } = thumbnailUrlModule as typeof import('../frontend/src/utils/thumbnail-url');
const gatewayHandler = gateway.default;

type CacheDouble = {
  match: (request: Request) => Promise<Response | undefined>;
  put: (request: Request, response: Response) => Promise<void>;
};

const cacheWrites: string[] = [];
const cacheDouble: CacheDouble = {
  match: async () => undefined,
  put: async (request) => {
    cacheWrites.push(request.url);
  },
};

Object.defineProperty(globalThis, 'caches', {
  configurable: true,
  value: { default: cacheDouble },
});

const optimizedBytes = new Uint8Array(90 * 1024);
const waitUntilPromises: Promise<unknown>[] = [];
const executionContext = {
  waitUntil: (promise: Promise<unknown>) => waitUntilPromises.push(promise),
};

const optimizedEnv = {
  APPS_ROOT_DOMAIN: 'gemigo.app',
  ASSETS: {
    get: async (key: string) => key.endsWith('thumbnail.webp')
      ? {
          body: new Response(optimizedBytes).body,
          httpEtag: '"optimized"',
          size: optimizedBytes.byteLength,
          writeHttpMetadata: (headers: Headers) => headers.set('content-type', 'image/webp'),
        }
      : null,
    put: async () => null,
  },
};

const optimizedResponse = await gatewayHandler.fetch(
  new Request('https://assets.gemigo.app/thumbnails/demo-app.webp'),
  optimizedEnv as never,
  executionContext as never,
);
assert.equal(optimizedResponse.status, 200);
assert.equal(optimizedResponse.headers.get('content-type'), 'image/webp');
assert.equal(optimizedResponse.headers.get('content-length'), String(90 * 1024));
assert.match(optimizedResponse.headers.get('cache-control') ?? '', /max-age=86400/);
await Promise.all(waitUntilPromises.splice(0));
assert.deepEqual(cacheWrites, ['https://assets.gemigo.app/thumbnails/demo-app.webp']);

const missingEnv = {
  APPS_ROOT_DOMAIN: 'gemigo.app',
  ASSETS: {
    get: async () => null,
    put: async () => null,
  },
};
const placeholderResponse = await gatewayHandler.fetch(
  new Request('https://assets.gemigo.app/thumbnails/missing-app.webp'),
  missingEnv as never,
  executionContext as never,
);
assert.equal(placeholderResponse.status, 200);
assert.match(placeholderResponse.headers.get('content-type') ?? '', /image\/svg\+xml/);
assert.equal(placeholderResponse.headers.get('x-gemigo-thumbnail'), 'generating');
await Promise.all(waitUntilPromises.splice(0));

assert.equal(
  getProjectThumbnailUrl('https://demo-app.gemigo.app/'),
  'https://assets.gemigo.app/thumbnails/demo-app.webp',
);
assert.equal(
  getProjectThumbnailUrl('https://example.com/app/'),
  'https://example.com/app/__thumbnail.png',
);

const gatewaySource = await import('node:fs/promises').then((fs) =>
  fs.readFile(new URL('../workers/r2-gateway/worker.ts', import.meta.url), 'utf8'),
);
const cardSource = await import('node:fs/promises').then((fs) =>
  fs.readFile(new URL('../frontend/src/components/explore-app-card.tsx', import.meta.url), 'utf8'),
);
const screenshotSource = await import('node:fs/promises').then((fs) =>
  fs.readFile(new URL('../workers/screenshot-service/worker.ts', import.meta.url), 'utf8'),
);

assert.match(gatewaySource, /MAX_OPTIMIZED_THUMBNAIL_BYTES = 100 \* 1024/);
assert.match(cardSource, /loading=\{imagePriority \? 'eager' : 'lazy'\}/);
assert.match(cardSource, /fetchPriority=\{imagePriority \? 'high' : 'low'\}/);
assert.match(cardSource, /width=\{960\}/);
assert.match(cardSource, /height=\{540\}/);
assert.match(screenshotSource, /WEBP_QUALITY_STEPS/);

console.log('thumbnail performance tests passed');
