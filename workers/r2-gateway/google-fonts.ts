/** Delivery-only Google Fonts acceleration; no customer source writes or open proxy. */
export const FONT_ROUTE_PREFIX = '/__gemigo/google-fonts/';
export const FONT_PREFIX = `${FONT_ROUTE_PREFIX}v3/`;
export const FONT_RUNTIME_PATH = '/__gemigo/google-fonts-runtime.v1.js';
export const FONT_CSS_MARKER = '__gemigo_fonts';
const UPSTREAM_TIMEOUT_MS = 2500;
const MAX_DOCUMENT_BYTES = 1024 * 1024;
const CSS_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function fontUrl(value: string, origin: string): string | null {
  if (!/^(?:https?:)?\/\/(?:fonts\.googleapis\.com|fonts\.gstatic\.com)\//i.test(value)) return null;
  const url = new URL(value.startsWith('//') ? `https:${value}` : value);
  if (url.username || url.password || url.port || url.search.length > 4096) return null;
  if (url.hostname === 'fonts.googleapis.com' && /^\/css2?$/.test(url.pathname)) {
    return `${origin}${FONT_PREFIX}${url.pathname.slice(1)}${url.search}`;
  }
  if (url.hostname === 'fonts.gstatic.com' && /^\/s\/[\w/.-]+\.(?:woff2?|ttf|otf)$/.test(url.pathname)) {
    return `${origin}${FONT_PREFIX}file${url.pathname}${url.search}`;
  }
  return null;
}

function markedStylesheet(value: string, base: string, ownerOrigin = new URL(base).origin): string | null {
  try {
    const url = new URL(value, base);
    if (url.origin !== ownerOrigin || !url.pathname.endsWith('.css')) return null;
    url.searchParams.set(FONT_CSS_MARKER, 'v1');
    return url.href;
  } catch { return null; }
}

// Consume comments and ordinary strings as whole tokens so quoted examples stay intact.
const CSS_TOKEN = /\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|url\(\s*(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^)"']*)\s*\)|@import\s+(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/gi;
export function rewriteFontCss(css: string, origin: string, stylesheet?: string, nonblocking = false): string {
  return css.replace(CSS_TOKEN, (token, offset: number) => {
    const isImport = /^@import/i.test(token);
    const urlImport = /^url\(/i.test(token) && /@import\s*$/i.test(css.slice(Math.max(0, offset - 40), offset));
    if (!isImport && !/^url\(/i.test(token)) return token;
    const raw = isImport ? token.replace(/^@import\s+/i, '') : token.slice(4, -1).trim();
    const value = /^['"]/.test(raw) ? raw.slice(1, -1) : raw;
    if (value.includes('\\')) return token;
    const replacement = fontUrl(value, origin) ?? ((isImport || urlImport) && stylesheet ? markedStylesheet(value, stylesheet) : null);
    if (nonblocking && replacement?.startsWith(`${origin}${FONT_PREFIX}`)
      && (isImport || urlImport) && /^\s*;/.test(css.slice(offset + token.length))) {
      const emptyCss = `data:text/css,/*__gemigo_font=${encodeURIComponent(replacement)}*/`;
      return isImport ? `@import "${emptyCss}"` : `url("${emptyCss}")`;
    }
    return replacement ? (isImport ? `@import "${replacement}"` : `url("${replacement}")`) : token;
  });
}

/** Buffer small documents for CSP preflight; oversized documents keep their original stream. */
export async function readSmallDocument(response: Response): Promise<{ text?: string; response: Response }> {
  if (!response.body) return { response };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    chunks.push(next.value); size += next.value.byteLength;
    if (size > MAX_DOCUMENT_BYTES) {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) { for (const chunk of chunks) controller.enqueue(chunk); },
        async pull(controller) {
          try { const next = await reader.read(); if (next.done) controller.close(); else controller.enqueue(next.value); }
          catch (error) { controller.error(error); }
        },
        cancel(reason) { return reader.cancel(reason); },
      });
      return { response: new Response(stream, response) };
    }
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return { text: new TextDecoder().decode(bytes), response: new Response(bytes, response) };
}

export async function rewriteFontHtml(response: Response, pageUrl: string, origin: string): Promise<Response> {
  if (response.headers.has('content-security-policy') || response.headers.has('content-security-policy-report-only')) return response;
  const document = await readSmallDocument(response);
  if (document.text === undefined || !/fonts\.(?:googleapis|gstatic)\.com|\.css/i.test(document.text)) return document.response;
  // Parse all meta elements before emitting any substitutions, including policies after resources.
  let restricted = false;
  await new HTMLRewriter().on('meta[http-equiv]', { element(element) {
    if (/^content-security-policy(?:-report-only)?$/i.test(element.getAttribute('http-equiv') ?? '')) restricted = true;
  } }).transform(new Response(document.text)).arrayBuffer();
  if (restricted) return document.response;
  let base = pageUrl, style = '', hasBase = false, enabled = false;
  return new HTMLRewriter()
    .on('base[href]', { element(element) {
      if (hasBase) return;
      hasBase = true;
      try { base = new URL(element.getAttribute('href')!, pageUrl).href; } catch { /* Keep page base. */ }
    } })
    .on('link[href]', { element(element) {
      if (element.hasAttribute('integrity') || element.getAttribute('crossorigin')?.toLowerCase() === 'use-credentials') return;
      const href = element.getAttribute('href')!;
      const replacement = fontUrl(href, origin)
        ?? (element.getAttribute('rel')?.toLowerCase() === 'stylesheet' ? markedStylesheet(href, base, new URL(pageUrl).origin) : null);
      if (replacement) {
        enabled = true;
        element.setAttribute('href', replacement);
        if (replacement.startsWith(`${origin}${FONT_PREFIX}`) && element.getAttribute('rel')?.toLowerCase() === 'stylesheet') {
          element.setAttribute('data-gemigo-font-media', element.getAttribute('media') ?? 'all');
          element.setAttribute('media', 'not all');
        }
      }
    } })
    .on('style', { element() { style = ''; }, text(chunk) {
      style += chunk.text;
      if (chunk.lastInTextNode) {
        const css = rewriteFontCss(style, origin, undefined, true);
        if (css.includes('__gemigo_font=')) enabled = true;
        chunk.replace(css, { html: true }); style = '';
      }
      else chunk.remove();
    } })
    .on('[style]', { element(element) {
      element.setAttribute('style', rewriteFontCss(element.getAttribute('style')!, origin));
    } })
    .onDocument({ end(end) {
      if (enabled) end.append(`<script async src="${origin}${FONT_RUNTIME_PATH}" data-gemigo-font-runtime></script>`, { html: true });
    } })
    .transform(document.response);
}

function fontResponse(request: Request, response: Response, cacheState: string): Response {
  const headers = new Headers(response.headers);
  headers.set('x-gemigo-font-cache', cacheState);
  const matches = request.headers.get('if-none-match')?.split(',').some(tag => tag.trim() === '*' || tag.trim().replace(/^W\//, '') === headers.get('etag'));
  const empty = request.method === 'HEAD' || matches;
  if (empty) { void response.body?.cancel().catch(() => {}); headers.delete('content-length'); }
  return new Response(empty ? null : response.body, { status: matches ? 304 : response.status, headers });
}

export async function serveGoogleFont(request: Request, ctx: ExecutionContext): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
  const url = new URL(request.url), part = url.pathname.slice(FONT_ROUTE_PREFIX.length).replace(/^v[23]\//, '');
  const isCss = /^css2?$/.test(part);
  const isFile = /^file\/s\/[\w/.-]+\.(?:woff2?|ttf|otf)$/.test(part) && !part.includes('..');
  if ((!isCss && !isFile) || url.search.length > 4096) return new Response('Not found', { status: 404 });
  const upstream = new URL(isCss ? `https://fonts.googleapis.com/${part}${url.search}` : `https://fonts.gstatic.com/${part.slice(5)}${url.search}`);
  if (isCss && ['auto', 'block', ''].includes(upstream.searchParams.get('display') ?? '')) upstream.searchParams.set('display', 'swap');
  const cacheKey = new Request(url.href, { method: 'GET' });
  const cache = caches.default;
  const cacheControl = request.headers.get('cache-control') ?? '';
  const noStore = /\bno-store\b/i.test(cacheControl);
  const bypass = noStore || /\bno-cache\b/i.test(cacheControl);
  if (!bypass) {
    const cached = await cache.match(cacheKey).catch(() => undefined);
    if (cached) return fontResponse(request, cached, 'HIT');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(upstream, { redirect: 'manual', signal: controller.signal,
      headers: isCss ? { 'user-agent': CSS_UA, accept: 'text/css' } : { accept: 'font/woff2,font/woff,application/octet-stream' } });
    const type = response.headers.get('content-type') ?? '';
    if (response.status !== 200 || !response.body || response.headers.has('set-cookie')
      || (isCss ? !/^text\/css\b/i.test(type) : !/^(?:font\/|application\/(?:octet-stream|font-|x-font-))/i.test(type))) { await response.body?.cancel(); throw new Error('Invalid font response'); }
    const limit = isCss ? 512 * 1024 : 5 * 1024 * 1024;
    if (Number(response.headers.get('content-length')) > limit) { await response.body.cancel(); throw new Error('Oversized font'); }
    const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const next = await reader.read(); if (next.done) break;
      size += next.value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error('Oversized font'); }
      chunks.push(next.value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const body = isCss ? new TextEncoder().encode(rewriteFontCss(new TextDecoder().decode(bytes), url.origin)) : bytes;
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', body))].map(x => x.toString(16).padStart(2, '0')).join('');
    const headers = new Headers({ 'content-type': isCss ? 'text/css; charset=utf-8' : type,
      'cache-control': isCss ? 'public, max-age=86400' : 'public, max-age=31536000, immutable',
      'access-control-allow-origin': '*', 'x-content-type-options': 'nosniff', etag: `"${hash}"` });
    const result = new Response(body, { headers });
    if (!noStore) ctx.waitUntil(cache.put(cacheKey, result.clone()).catch(() => {}));
    return fontResponse(request, result, bypass ? 'BYPASS' : 'MISS');
  } catch {
    return new Response(request.method === 'HEAD' ? null : isCss ? '/* Font upstream unavailable; use author fallback fonts. */' : 'Font unavailable', {
      status: isCss ? 200 : 503,
      headers: { 'content-type': isCss ? 'text/css; charset=utf-8' : 'text/plain', 'cache-control': 'no-store',
        'access-control-allow-origin': '*', 'x-content-type-options': 'nosniff', 'x-gemigo-font-cache': 'FALLBACK' },
    });
  } finally { clearTimeout(timer); }
}

// Font-face styles load after document readiness; the author's visual CSS renders immediately.
export const FONT_RUNTIME = `(() => {
  const origin = new URL(document.currentScript.src).origin;
  const seen = new Set();
  const add = value => {
    try {
      const url = new URL(value);
      if (url.origin !== origin || !url.pathname.startsWith('${FONT_PREFIX}') || seen.has(url.href)) return;
      seen.add(url.href);
      const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = url.href;
      document.head.append(link);
    } catch {}
  };
  const restore = link => {
    if (link.hasAttribute('data-gemigo-font-media')) {
      link.media = link.getAttribute('data-gemigo-font-media'); link.removeAttribute('data-gemigo-font-media');
    }
  };
  document.addEventListener('load', event => {
    if (event.target.tagName === 'LINK') restore(event.target);
  }, true);
  const inspect = (sheet, depth = 0) => {
    if (!sheet || depth > 10) return;
    try {
      for (const rule of Array.from(sheet.cssRules).slice(0, 5000)) {
        if (rule.type !== 3) continue;
        const marker = /^data:text\\/css,\\/\\*__gemigo_font=(.*?)\\*\\/$/.exec(rule.href);
        if (marker) add(decodeURIComponent(marker[1]));
        else inspect(rule.styleSheet, depth + 1);
      }
    } catch {}
  };
  const start = () => {
    document.querySelectorAll('link[data-gemigo-font-media]').forEach(link => {
      seen.add(link.href); if (link.sheet) restore(link);
    });
    Array.from(document.styleSheets).forEach(sheet => inspect(sheet));
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();`;
