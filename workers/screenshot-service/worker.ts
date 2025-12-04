type BrowserBinding = {
  newPage(): Promise<BrowserPage>;
};

type BrowserPage = {
  goto(url: string, options?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' }): Promise<void>;
  setViewportSize(options: { width: number; height: number }): Promise<void>;
  screenshot(options?: { type?: 'png' | 'jpeg' }): Promise<ArrayBuffer | ReadableStream>;
  close(): Promise<void>;
};

type Env = {
  // Cloudflare Browser Rendering binding (configured via wrangler / dashboard).
  BROWSER: BrowserBinding;
};

interface ScreenshotRequestBody {
  url?: string;
}

export default {
  /**
   * Simple screenshot service used by the R2 gateway worker.
   *
   * - Accepts POST requests with JSON body: { "url": "https://example.com/" }
   * - Uses Cloudflare Browser Rendering (BROWSER binding) to capture a PNG
   *   screenshot of the given URL.
   * - Returns the PNG as the response body with content-type image/png.
   */
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    let payload: ScreenshotRequestBody;
    try {
      payload = (await request.json()) as ScreenshotRequestBody;
    } catch {
      return new Response('Invalid JSON body', { status: 400 });
    }

    const targetUrl = payload.url?.trim();
    if (!targetUrl) {
      return new Response('Missing "url" field in request body', {
        status: 400,
      });
    }

    let page: BrowserPage | null = null;

    try {
      const browser = env.BROWSER;
      page = await browser.newPage();

      // Set a reasonable viewport size for thumbnails.
      await page.setViewportSize({ width: 1200, height: 675 });

      // Navigate to the target URL and wait until the network is mostly idle.
      await page.goto(targetUrl, { waitUntil: 'networkidle' });

      const png = await page.screenshot({ type: 'png' });

      return new Response(png, {
        headers: {
          'content-type': 'image/png',
          'cache-control': 'public, max-age=600',
        },
      });
    } catch (err) {
      console.error('Screenshot service failed', err);
      return new Response('Failed to capture screenshot', { status: 500 });
    } finally {
      if (page) {
        try {
          await page.close();
        } catch {
          // Ignore close errors
        }
      }
    }
  },
};

