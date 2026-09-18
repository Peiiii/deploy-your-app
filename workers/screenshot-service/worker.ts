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
}

const OPTIMIZED_WIDTH = 960;
const OPTIMIZED_HEIGHT = 540;
const DEFAULT_MAX_BYTES = 100 * 1024;
const WEBP_QUALITY_STEPS = [78, 68, 58, 48, 38, 30] as const;

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
      browser = await puppeteer.launch(env.BROWSER);
      const page = await browser.newPage();

      await page.setViewport(
        format === 'webp'
          ? { width: OPTIMIZED_WIDTH, height: OPTIMIZED_HEIGHT }
          : { width: 1280, height: 720 },
      );

      await page.goto(imageUrl || targetUrl, {
        waitUntil: 'networkidle0',
        timeout: 20000,
      });

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
        for (const quality of WEBP_QUALITY_STEPS) {
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
