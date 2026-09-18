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
  new Request(
    'https://assets.gemigo.app/thumbnails/missing-app.webp?name=%E0%B8%97%E0%B8%94%E0%B8%AA%E0%B8%AD%E0%B8%9A&seed=thai-project',
  ),
  missingEnv as never,
  executionContext as never,
);
assert.equal(placeholderResponse.status, 200);
assert.match(placeholderResponse.headers.get('content-type') ?? '', /image\/svg\+xml/);
assert.equal(placeholderResponse.headers.get('x-gemigo-thumbnail'), 'generating');
const placeholderSvg = await placeholderResponse.text();
assert.match(placeholderSvg, />ท<\/text>/);
assert.match(placeholderSvg, /rotate\(-12 480 270\)/);
assert.doesNotMatch(placeholderSvg, /#2563eb/);
const latinPlaceholderResponse = await gatewayHandler.fetch(
  new Request(
    'https://assets.gemigo.app/thumbnails/journal-app.webp?name=Journal&seed=project-j',
  ),
  missingEnv as never,
  executionContext as never,
);
const latinPlaceholderSvg = await latinPlaceholderResponse.text();
assert.match(latinPlaceholderSvg, />J<\/text>/);
assert.notEqual(
  latinPlaceholderSvg.match(/<stop stop-color="([^"]+)"/)?.[1],
  placeholderSvg.match(/<stop stop-color="([^"]+)"/)?.[1],
);
await Promise.all(waitUntilPromises.splice(0));

const legacyPngBytes = new Uint8Array(48 * 1024);
const legacyPngEnv = {
  APPS_ROOT_DOMAIN: 'gemigo.app',
  SCREENSHOT_SERVICE_URL: 'https://screenshot.example.test',
  SCREENSHOT_SERVICE: {
    fetch: async () => new Response('rate limited', { status: 429 }),
  },
  ASSETS: {
    get: async (key: string) => key.endsWith('thumbnail.png')
      ? {
          body: new Response(legacyPngBytes).body,
          httpEtag: '"legacy-png"',
          httpMetadata: { contentType: 'image/png' },
          size: legacyPngBytes.byteLength,
          writeHttpMetadata: (headers: Headers) => headers.set('content-type', 'image/png'),
        }
      : null,
    put: async () => null,
  },
};
const legacyPngResponse = await gatewayHandler.fetch(
  new Request('https://assets.gemigo.app/thumbnails/legacy-app.webp?name=Legacy'),
  legacyPngEnv as never,
  executionContext as never,
);
assert.equal(legacyPngResponse.status, 200);
assert.equal(legacyPngResponse.headers.get('content-type'), 'image/png');
assert.equal(legacyPngResponse.headers.get('content-length'), String(legacyPngBytes.byteLength));
assert.equal(legacyPngResponse.headers.get('x-gemigo-thumbnail'), 'legacy');
assert.equal((await legacyPngResponse.arrayBuffer()).byteLength, legacyPngBytes.byteLength);
await Promise.all(waitUntilPromises.splice(0));

let promoted = false;
const uploadBytes = new Uint8Array(72 * 1024);
const promotableEnv = {
  APPS_ROOT_DOMAIN: 'gemigo.app',
  ASSETS: {
    get: async (key: string) => {
      if (key.endsWith('thumbnail.webp') && !promoted) return null;
      if (key.endsWith('thumbnail.webp') || key.endsWith('thumbnail.png')) {
        return {
          body: new Response(uploadBytes).body,
          httpEtag: '"uploaded-webp"',
          httpMetadata: { contentType: 'image/webp' },
          size: uploadBytes.byteLength,
          writeHttpMetadata: (headers: Headers) => headers.set('content-type', 'image/webp'),
        };
      }
      return null;
    },
    put: async (key: string) => {
      assert.equal(key, 'apps/uploaded-cover/thumbnail.webp');
      promoted = true;
      return null;
    },
  },
};
const promotedResponse = await gatewayHandler.fetch(
  new Request('https://assets.gemigo.app/thumbnails/uploaded-cover.webp'),
  promotableEnv as never,
  executionContext as never,
);
assert.equal(promoted, true);
assert.equal(promotedResponse.status, 200);
assert.equal(promotedResponse.headers.get('content-type'), 'image/webp');
assert.equal(promotedResponse.headers.get('content-length'), String(72 * 1024));
await Promise.all(waitUntilPromises.splice(0));

assert.equal(
  getProjectThumbnailUrl('https://demo-app.gemigo.app/', {
    name: 'ทดสอบ',
    seed: 'project-42',
  }),
  'https://assets.gemigo.app/thumbnails/demo-app.webp?name=%E0%B8%97%E0%B8%94%E0%B8%AA%E0%B8%AD%E0%B8%9A&seed=project-42',
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
