import type { Browser } from '@cloudflare/puppeteer';
import puppeteer, { type BrowserWorker } from '@cloudflare/puppeteer';

interface ScreenshotRequestBody {
  format?: 'png' | 'webp';
  imageUrl?: string;
  maxBytes?: number;
  url?: string;
}

interface Env {
  BROWSER: BrowserWorker;
  ASSETS: {
    get(key: string): Promise<unknown | null>;
    put(key: string, value: ArrayBuffer | Blob, options?: {
      httpMetadata: { cacheControl: string; contentType: string };
    }): Promise<unknown>;
    delete(key: string): Promise<void>;
  };
  APPS_ROOT_DOMAIN?: string;
}

interface ThumbnailJob {
  slug: string;
  hasLegacyThumbnail: boolean;
}

interface ThumbnailQueueMessage {
  body: ThumbnailJob;
  attempts: number;
  retry(options: { delaySeconds: number }): void;
}

const OPTIMIZED_WIDTH = 960;
const OPTIMIZED_HEIGHT = 540;
const DEFAULT_MAX_BYTES = 300 * 1024;
const WEBP_CAPTURE_STEPS = [
  { width: 960, quality: 72 },
  { width: 800, quality: 58 },
  { width: 640, quality: 44 },
  { width: 480, quality: 30 },
] as const;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return '未知错误';
}

const handleScreenshotRequest = async (
  request: Request,
  env: Env,
  onStage: (stage: string) => void = () => {},
): Promise<Response> => {
    const { searchParams } = new URL(request.url);

    let targetUrl = searchParams.get("url");
    let imageUrl: string | null = null;
    let format: 'png' | 'webp' = 'png';
    let maxBytes = DEFAULT_MAX_BYTES;

    if (!targetUrl && request.method === 'POST') {
      try {
        const body = (await request.json()) as ScreenshotRequestBody;
        targetUrl = body.url ?? null;
        imageUrl = body.imageUrl ?? null;
        format = body.format === 'webp' ? 'webp' : 'png';
        if (typeof body.maxBytes === 'number' && Number.isFinite(body.maxBytes)) {
          maxBytes = Math.min(DEFAULT_MAX_BYTES, Math.max(16 * 1024, Math.floor(body.maxBytes)));
        }
      } catch {
        // 忽略 JSON 解析错误，继续使用 URL 参数
      }
    }

    // 如果还没有拿到 URL，提示用户怎么用
    if (!targetUrl) {
      return new Response(
        "请在网址后面加上 url 参数，例如：\n" + 
        request.url + "?url=https://www.bilibili.com", 
        { status: 400 }
      );
    }

    // 补全 http 协议 (方便用户偷懒只输 www.baidu.com)
    if (!targetUrl.startsWith("http")) {
      targetUrl = "https://" + targetUrl;
    }
    if (imageUrl && !imageUrl.startsWith('http')) {
      imageUrl = `https://${imageUrl}`;
    }

    if (!env.BROWSER) {
      return new Response("未配置 Browser Rendering (BROWSER binding missing)", { status: 500 });
    }

    let browser: Browser | null = null;
    try {
      onStage('browser launch');
      browser = await puppeteer.launch(env.BROWSER);
      onStage('new page');
      const page = await browser.newPage();

      await page.setViewport(
        format === 'webp'
          ? { width: OPTIMIZED_WIDTH, height: OPTIMIZED_HEIGHT }
          : { width: 1280, height: 720 },
      );

      onStage('navigation');
      await page.goto(imageUrl || targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 12000,
      });
      onStage('render wait');
      await new Promise((resolve) => setTimeout(resolve, 1200));

      if (imageUrl) {
        await page.evaluate(() => {
          document.documentElement.style.margin = '0';
          document.documentElement.style.width = '100%';
          document.documentElement.style.height = '100%';
          document.body.style.margin = '0';
          document.body.style.width = '100%';
          document.body.style.height = '100%';
          document.body.style.overflow = 'hidden';
          document.body.style.background = '#0f172a';
          const image = document.querySelector('img');
          if (image) {
            image.style.width = '100vw';
            image.style.height = '100vh';
            image.style.maxWidth = 'none';
            image.style.maxHeight = 'none';
            image.style.objectFit = 'cover';
            image.style.objectPosition = 'center';
          }
        });
      }

      let imgBuffer: Uint8Array;
      onStage('screenshot');
      if (format === 'webp') {
        let optimized: Uint8Array | null = null;
        for (const { width, quality } of WEBP_CAPTURE_STEPS) {
          if (width !== OPTIMIZED_WIDTH) {
            await page.setViewport({
              width,
              height: Math.round(width * OPTIMIZED_HEIGHT / OPTIMIZED_WIDTH),
            });
          }
          const candidate = await page.screenshot({
            type: 'webp',
            quality,
          });
          if (!optimized || candidate.byteLength < optimized.byteLength) {
            optimized = candidate;
          }
          if (candidate.byteLength <= maxBytes) {
            optimized = candidate;
            break;
          }
        }
        if (!optimized || optimized.byteLength > maxBytes) {
          return new Response('截图压缩后仍超过大小限制', { status: 413 });
        }
        imgBuffer = optimized;
      } else {
        imgBuffer = await page.screenshot({ type: 'png' });
      }

      onStage('browser close');
      await browser.close();
      browser = null;

      const arrayBuffer = imgBuffer.buffer instanceof ArrayBuffer
        ? imgBuffer.buffer.slice(imgBuffer.byteOffset, imgBuffer.byteOffset + imgBuffer.byteLength)
        : new Uint8Array(imgBuffer).buffer;

      return new Response(arrayBuffer, {
        headers: {
          'cache-control': format === 'webp'
            ? 'public, max-age=86400'
            : 'public, max-age=600',
          'content-length': String(imgBuffer.byteLength),
          'content-type': format === 'webp' ? 'image/webp' : 'image/png',
        },
      });

    } catch (error: unknown) {
      const message = getErrorMessage(error);
      console.error(JSON.stringify({
        message: 'Screenshot generation failed',
        error: message,
        format,
        hasImageSource: Boolean(imageUrl),
      }));
      return new Response(`截图失败: ${message}`, { status: 500 });
    } finally {
      if (browser) {
        await browser.close();
      }
    }
};

const processThumbnailJob = async (
  job: ThumbnailJob,
  env: Env,
  onStage: (stage: string) => void,
): Promise<void> => {
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(job.slug)) {
    throw new Error('Invalid thumbnail slug');
  }

  const thumbnailKey = `apps/${job.slug}/thumbnail.webp`;
  const markerKey = `apps/${job.slug}/thumbnail-queued`;
  if (await env.ASSETS.get(thumbnailKey)) {
    await env.ASSETS.delete(markerKey);
    return;
  }

  const targetUrl = `https://${job.slug}.${env.APPS_ROOT_DOMAIN || 'gemigo.app'}/`;
  const response = await handleScreenshotRequest(new Request('https://internal/screenshot', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      url: targetUrl,
      ...(job.hasLegacyThumbnail ? { imageUrl: `${targetUrl}__thumbnail.png` } : {}),
      format: 'webp',
      maxBytes: DEFAULT_MAX_BYTES,
    }),
  }), env, onStage);
  if (!response.ok) {
    throw new Error(`Screenshot service returned ${response.status}: ${(await response.text()).slice(0, 500)}`);
  }

  const image = await response.arrayBuffer();
  if (image.byteLength <= 80 || image.byteLength > DEFAULT_MAX_BYTES) {
    throw new Error(`Invalid screenshot size: ${image.byteLength}`);
  }
  onStage('R2 write');
  await env.ASSETS.put(thumbnailKey, image, {
    httpMetadata: {
      cacheControl: 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
      contentType: 'image/webp',
    },
  });
  await env.ASSETS.delete(markerKey);
  await env.ASSETS.delete(`apps/${job.slug}/thumbnail-error.json`);
};

export default {
  fetch: handleScreenshotRequest,
  async queue(batch: { messages: ThumbnailQueueMessage[] }, env: Env): Promise<void> {
    for (const message of batch.messages) {
      const startedAt = Date.now();
      let stage = 'R2 read';
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          processThumbnailJob(message.body, env, (nextStage) => { stage = nextStage; }),
          new Promise<never>((_resolve, reject) => {
            timeout = setTimeout(() => reject(new Error(`Screenshot job timed out at ${stage}`)), 60_000);
          }),
        ]);
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        console.error(JSON.stringify({
          message: 'Queued thumbnail generation failed',
          slug: message.body.slug,
          attempt: message.attempts,
          error: errorMessage,
        }));
        try {
          await env.ASSETS.put(`apps/${message.body.slug}/thumbnail-error.json`, new Blob([
            JSON.stringify({
              time: new Date().toISOString(),
              attempt: message.attempts,
              error: errorMessage,
            }),
          ], { type: 'application/json' }));
        } catch (writeError) {
          console.error('Failed to persist thumbnail error', writeError);
        }
        message.retry({ delaySeconds: Math.min(3600, 60 * message.attempts) });
      } finally {
        if (timeout) clearTimeout(timeout);
        const remaining = 20_000 - (Date.now() - startedAt);
        if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
      }
    }
  },
};
