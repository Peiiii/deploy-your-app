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
  APP_CONTENT_TOKEN?: string;
  APPS_ROOT_DOMAIN?: string;
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestUrl = new URL(request.url);
    if (requestUrl.pathname === '/content') return extractAppContent(request, env);
    const { searchParams } = requestUrl;

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
      browser = await puppeteer.launch(env.BROWSER);
      const page = await browser.newPage();

      await page.setViewport(
        format === 'webp'
          ? { width: OPTIMIZED_WIDTH, height: OPTIMIZED_HEIGHT }
          : { width: 1280, height: 720 },
      );

      await page.goto(imageUrl || targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 12000,
      });
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
  }
}

/** Authenticated internal consumer; public screenshot behavior is unchanged. */
async function extractAppContent(request: Request, env: Env): Promise<Response> {
  if (
    request.method !== 'POST' ||
    !env.APP_CONTENT_TOKEN ||
    request.headers.get('x-gemigo-content-token') !== env.APP_CONTENT_TOKEN
  )
    return new Response('Not found', { status: 404 });
  const allowed = (value: string): boolean => {
    try {
      const url = new URL(value);
      return (
        url.protocol === 'https:' &&
        url.hostname.endsWith(`.${env.APPS_ROOT_DOMAIN || 'gemigo.app'}`) &&
        !url.username &&
        !url.password &&
        !url.port
      );
    } catch {
      return false;
    }
  };
  let browser: Browser | null = null;
  let stage = 'validate';
  try {
    const body = (await request.json()) as { url?: string };
    if (typeof body.url !== 'string' || !allowed(body.url))
      return new Response('Invalid app URL', { status: 400 });
    stage = 'launch';
    const acquired = await puppeteer.acquire(env.BROWSER);
    stage = 'connect';
    browser = await Promise.race([puppeteer.connect(env.BROWSER, acquired.sessionId), new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Browser connection timed out')), 10000))]);
    const page = await browser.newPage();
    stage = 'configure';
    await page.setViewport({ width: 1280, height: 720 });
    await page.setRequestInterception(true);
    page.on('request', (intercepted) => {
      if (
        intercepted.isNavigationRequest() &&
        intercepted.frame() === page.mainFrame() &&
        !allowed(intercepted.url())
      )
        void intercepted.abort();
      else void intercepted.continue();
    });
    stage = 'navigate';
    const response = await page.goto(body.url, { waitUntil: 'domcontentloaded', timeout: 12000 });
    if (!response?.ok() || !allowed(page.url()))
      return new Response('App unavailable', { status: 422 });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    // Hydrated apps often start with an empty shell. Bound waiting for actual text.
    await page
      .waitForFunction(() => (document.body?.innerText.trim().length ?? 0) >= 20, { timeout: 3000 })
      .catch(() => undefined);
    stage = 'extract';
    const content = await page.evaluate(() => ({
      text: (document.body?.innerText ?? '').slice(0, 6000),
      controls: Array.from(
        document.querySelectorAll('button, label, nav, [role="button"], input[placeholder], select')
      )
        .filter((el) => el.getClientRects().length > 0)
        .map((el) => el.textContent || el.getAttribute('placeholder') || '')
        .join('\n')
        .slice(0, 2000),
      htmlLang: document.documentElement.lang.slice(0, 32),
    }));
    return Response.json(content, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    console.warn('App content extraction failed', stage, getErrorMessage(error).slice(0, 200));
    return Response.json({ error: 'render_unavailable', stage }, { status: 503 });
  } finally {
    if (browser) {
      await Promise.race([browser.close().catch(() => undefined), new Promise(resolve => setTimeout(resolve, 3000))]);
    }
  }
}
