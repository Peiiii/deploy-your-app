import type { Browser } from '@cloudflare/puppeteer';
import puppeteer, { type BrowserWorker } from '@cloudflare/puppeteer';

interface ScreenshotRequestBody {
  url?: string;
}

interface Env {
  BROWSER: BrowserWorker;
}

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

    if (!targetUrl && request.method === 'POST') {
      try {
        const body = (await request.json()) as ScreenshotRequestBody;
        targetUrl = body.url ?? null;
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

    if (!env.BROWSER) {
      return new Response("未配置 Browser Rendering (BROWSER binding missing)", { status: 500 });
    }

    let browser: Browser | null = null;
    try {
      browser = await puppeteer.launch(env.BROWSER);
      const page = await browser.newPage();

      await page.setViewport({ width: 1280, height: 720 });

      await page.goto(targetUrl, { 
        waitUntil: 'networkidle0',
        timeout: 20000 
      });

      const imgBuffer = await page.screenshot({ type: 'png' });

      await browser.close();
      browser = null;

      const arrayBuffer = imgBuffer.buffer instanceof ArrayBuffer
        ? imgBuffer.buffer.slice(imgBuffer.byteOffset, imgBuffer.byteOffset + imgBuffer.byteLength)
        : new Uint8Array(imgBuffer).buffer;

      return new Response(arrayBuffer, {
        headers: {
          'content-type': 'image/png',
          'cache-control': 'public, max-age=600'
        }
      });

    } catch (error: unknown) {
      return new Response(`截图失败: ${getErrorMessage(error)}`, { status: 500 });
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}