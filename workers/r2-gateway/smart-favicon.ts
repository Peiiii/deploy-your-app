/** Self-contained browser code, served as a same-origin script by the gateway. */
export const SMART_FAVICON_RUNTIME = String.raw`(() => {
  'use strict';
  const platform = 'link[data-gemigo-favicon]';
  const deadline = Date.now() + 10000;
  const seen = new WeakSet();
  const invalid = new Set();
  let observer, timer, running = false, dirty = false, stopped = false, rootChecked = false, rootOriginal = false;
  let lastMode = '';
  const mark = mode => { document.documentElement.dataset.gemigoFavicon = mode; lastMode = mode; };
  const stop = () => { stopped = true; clearTimeout(timer); if (observer) observer.disconnect(); document.removeEventListener('load', imageLoaded, true); };
  const allowed = value => {
    try { return /^(https?:|data:|blob:)$/.test(new URL(value, document.baseURI).protocol); }
    catch { return false; }
  };
  const decode = url => new Promise(resolve => {
    if (!allowed(url)) return resolve(null);
    const image = new Image();
    const timeout = setTimeout(() => { image.src = ''; resolve(null); }, Math.min(1500, Math.max(1, deadline - Date.now())));
    image.onload = () => { clearTimeout(timeout); resolve(image.naturalWidth >= 16 && image.naturalHeight >= 16 ? image : null); };
    image.onerror = () => { clearTimeout(timeout); resolve(null); };
    image.src = url;
  });
  const apply = (href, mode) => {
    if (stopped || Date.now() > deadline || !allowed(href)) return;
    let link = document.querySelector(platform);
    if (!link) { link = document.createElement('link'); link.dataset.gemigoFavicon = ''; document.head.append(link); }
    for (const broken of invalid) broken.remove();
    link.rel = 'icon'; link.removeAttribute('type'); link.removeAttribute('sizes'); link.href = href;
    mark(mode);
  };
  const canvas = () => { const c = document.createElement('canvas'); c.width = c.height = 64; return c; };
  const imageIcon = image => {
    const c = canvas(), ctx = c.getContext('2d');
    if (!ctx) return image.src;
    const scale = Math.min(56 / image.naturalWidth, 56 / image.naturalHeight);
    ctx.drawImage(image, (64 - image.naturalWidth * scale) / 2, (64 - image.naturalHeight * scale) / 2,
      image.naturalWidth * scale, image.naturalHeight * scale);
    try {
      const pixels = ctx.getImageData(0, 0, 64, 64).data;
      let visible = false;
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0) { visible = true; break; }
      return visible ? c.toDataURL('image/png') : null;
    } catch { return image.src; }
  };
  const initial = text => {
    const value = text.trim().replace(/^[\s\p{P}\p{S}]+/u, '') || text.trim() || location.hostname;
    return typeof Intl.Segmenter === 'function'
      ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)[Symbol.iterator]().next().value.segment
      : Array.from(value)[0];
  };
  const textIcon = (text, foreground, background) => {
    const c = canvas(), ctx = c.getContext('2d'); if (!ctx) return null;
    ctx.fillStyle = background || '#6366f1'; ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = foreground || '#fff'; ctx.font = 'bold 42px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(initial(text).toLocaleUpperCase(), 32, 34, 56);
    return c.toDataURL('image/png');
  };
  const svgIcon = async element => {
    const source = [element, ...element.querySelectorAll('*')];
    if (source.length > 150) return null;
    const clone = element.cloneNode(true), copies = [clone, ...clone.querySelectorAll('*')];
    const tags = new Set(['svg','g','path','rect','circle','ellipse','line','polyline','polygon','defs','lineargradient','radialgradient','stop','clippath','mask','text','tspan','use','symbol','title','desc']);
    const properties = ['fill','fill-opacity','fill-rule','stroke','stroke-width','stroke-opacity','stroke-linecap','stroke-linejoin','opacity','color','font-family','font-size','font-weight','text-anchor'];
    for (let i = 0; i < copies.length; i++) {
      const node = copies[i];
      if (!tags.has(node.localName.toLowerCase())) { node.remove(); continue; }
      for (const attr of Array.from(node.attributes)) {
        if (/^on/i.test(attr.name) || attr.name === 'style' || ((attr.localName === 'href') && !attr.value.startsWith('#'))) node.removeAttribute(attr.name);
      }
      const style = getComputedStyle(source[i]);
      for (const property of properties) {
        let value = style.getPropertyValue(property);
        value = value.replace(/url\(["']?[^)#]*#([^)'"\s]+)["']?\)/g, 'url(#$1)');
        if (value && (!value.includes('url(') || /^url\(#[\w.-]+\)$/.test(value))) node.style.setProperty(property, value);
      }
    }
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    if (!clone.hasAttribute('viewBox')) {
      const rect = element.getBoundingClientRect();
      clone.setAttribute('viewBox', '0 0 ' + rect.width + ' ' + rect.height);
    }
    clone.setAttribute('width', '64'); clone.setAttribute('height', '64');
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
    try {
      const image = await decode(url), href = image ? imageIcon(image) : null;
      return href && href.startsWith('data:') ? href : null;
    }
    finally { URL.revokeObjectURL(url); }
  };
  const semantics = element => {
    let score = 0, node = element;
    for (let depth = 0; node && depth < 3; depth++, node = node.parentElement) {
      const label = [node.id, node.getAttribute('class'), node.getAttribute('alt'), node.getAttribute('aria-label')].join(' ').replace(/([a-z])([A-Z])/g, '$1-$2');
      if (/(?:^|[\s_-])(logo|brand|favicon|app-icon|site-icon|标志|徽标|品牌)(?:$|[\s_-])/i.test(label)) score = Math.max(score, 100 - depth * 15);
    }
    if (!score && element.closest('nav,header,[role=banner]')) {
      const title = document.title.split(/[|·—]/)[0].toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
      const parent = element.parentElement, text = parent?.textContent.trim() || '';
      if (title.length >= 2 && text.length <= 80 && parent.querySelectorAll('img,svg').length === 1 &&
        text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '').includes(title)) score = 85;
    }
    if (!score) return 0;
    if (element.closest('button,[role=button],.music-btn,.search-icon,.mic')) return 0;
    const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
    if (rect.width < 12 || rect.height < 12 || style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) return 0;
    if (rect.width / rect.height > 2.25 || rect.height / rect.width > 2.25) return 0;
    if (element.closest('nav,header')) score += 20;
    if (rect.top >= 0 && rect.top < 300) score += 10;
    return score;
  };
  const declaredIcon = async () => {
    const links = Array.from(document.querySelectorAll('link[rel]')).filter(link =>
      !link.matches(platform) && link.rel.toLowerCase().split(/\s+/).includes('icon'));
    for (const link of links.slice(0, 8)) {
      if (link.media && !matchMedia(link.media).matches) continue;
      const url = new URL(link.href, document.baseURI);
      if (url.origin === location.origin && url.pathname === '/favicon.ico' && !await originalRoot()) { invalid.add(link); continue; }
      if (await decode(link.href)) { document.querySelector(platform)?.remove(); mark('original'); stop(); return true; }
      invalid.add(link);
    }
    return false;
  };
  const originalRoot = async () => {
    if (rootChecked) return rootOriginal; rootChecked = true;
    const url = new URL('/favicon.ico', location.origin).href;
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 1500);
    try {
      const response = await fetch(url, { signal: controller.signal });
      rootOriginal = response.ok && !response.headers.has('x-gemigo-favicon') && !/text\/html/.test(response.headers.get('content-type') || '');
      if (response.body) await response.body.cancel();
    } catch { /* Offline/missing root icon: continue with the visible page. */ }
    finally { clearTimeout(timeout); }
    return rootOriginal;
  };
  const checkRoot = async () => {
    const url = new URL('/favicon.ico', location.origin).href;
    if (await originalRoot() && await decode(url)) { apply(url, 'original-root'); stop(); return true; }
    return false;
  };
  const alternativeIcons = async () => {
    const links = Array.from(document.querySelectorAll('link[href]')).filter(link =>
      /^(favicon|apple-touch-icon(?:-precomposed)?|mask-icon)$/i.test(link.rel.trim()) ||
      (!link.rel && /(?:^|\/)(?:favicon|app-icon)[\w.-]*\.(?:png|ico|svg|webp)(?:[?#]|$)/i.test(link.href)));
    for (const link of links.slice(0, 4)) {
      if (seen.has(link)) continue; seen.add(link);
      const image = await decode(link.href);
      const href = image ? imageIcon(image) : null;
      if (href) { apply(href, 'recovered-icon'); stop(); return true; }
    }
    const manifest = document.querySelector('link[rel=manifest]');
    if (manifest && !seen.has(manifest)) {
      seen.add(manifest);
      const url = new URL(manifest.href, document.baseURI);
      if (url.origin !== location.origin) return false;
      const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 1500);
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) { if (response.body) await response.body.cancel(); return false; }
        const reader = response.body?.getReader(), decoder = new TextDecoder();
        let text = '', bytes = 0;
        if (reader) {
          while (true) {
            const chunk = await reader.read(); if (chunk.done) break;
            bytes += chunk.value.byteLength;
            if (bytes > 65536) { await reader.cancel(); return false; }
            text += decoder.decode(chunk.value, { stream: true });
          }
          text += decoder.decode();
        }
        const data = JSON.parse(text);
        for (const icon of (Array.isArray(data.icons) ? data.icons : []).slice(0, 4)) {
          if (typeof icon.src !== 'string') continue;
          const image = await decode(new URL(icon.src, response.url || url).href);
          const href = image ? imageIcon(image) : null;
          if (href) { apply(href, 'manifest'); stop(); return true; }
        }
      } catch { /* Malformed/absent manifest: continue. */ }
      finally { clearTimeout(timeout); }
    }
    return false;
  };
  const scan = async () => {
    if (running || stopped || Date.now() > deadline) return;
    running = true;
    try {
      if (await declaredIcon() || await checkRoot() || await alternativeIcons()) return;
      const candidates = Array.from(document.querySelectorAll('img,svg,[class*=logo],[class*=brand],[id*=logo],[id*=brand]')).slice(0, 500)
        .map(element => ({ element, score: semantics(element) })).filter(item => item.score >= 80)
        .sort((a,b) => b.score - a.score).slice(0, 8);
      for (const { element } of candidates) {
        if (seen.has(element)) continue;
        let href = null, mode = 'logo-text';
        if (element.localName === 'img') {
          const image = await decode(element.currentSrc || element.src);
          if (!image) continue;
          if (image.naturalWidth / image.naturalHeight > 2.25 || image.naturalHeight / image.naturalWidth > 2.25) { seen.add(element); continue; }
          href = imageIcon(image); mode = 'logo-image';
        } else if (element.localName === 'svg') { href = await svgIcon(element); mode = 'logo-svg'; }
        else if (!element.querySelector('img,svg')) {
          const style = getComputedStyle(element);
          const background = style.backgroundImage.match(/^url\(["']?([^"')]+)["']?\)$/);
          if (background) {
            const image = await decode(background[1]);
            if (image && image.naturalWidth / image.naturalHeight <= 2.25 && image.naturalHeight / image.naturalWidth <= 2.25) {
              href = imageIcon(image); mode = 'logo-background';
            }
          } else if (element.textContent.trim() && Array.from(element.textContent.trim()).length <= 2) {
            href = textIcon(element.textContent, style.color, style.backgroundColor === 'rgba(0, 0, 0, 0)' ? null : style.backgroundColor);
          }
        }
        seen.add(element);
        if (href) { apply(href, mode); stop(); return; }
      }
      if (lastMode !== 'name') { const href = textIcon(document.title || location.hostname); if (href) apply(href, 'name'); }
    } catch { /* Identification must not break the app. */ }
    finally { running = false; if (dirty && !stopped) { dirty = false; clearTimeout(timer); timer = setTimeout(scan, 250); } }
  };
  const schedule = () => {
    if (stopped) return;
    if (running) dirty = true;
    else { clearTimeout(timer); timer = setTimeout(scan, 250); }
  };
  const imageLoaded = event => { if (event.target instanceof HTMLImageElement) schedule(); };
  const start = () => {
    observer = new MutationObserver(schedule);
    document.addEventListener('load', imageLoaded, true);
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src','class','href','rel','style'] });
    const expiry = setTimeout(() => { stop(); if (!lastMode) mark('name'); }, Math.max(1, deadline - Date.now()));
    addEventListener('pagehide', () => { clearTimeout(expiry); stop(); }, { once: true });
    void scan();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();`;

export const SMART_FAVICON_PATH = '/__gemigo/favicon-runtime.v1.js';
export const SMART_FAVICON_FALLBACK_PATH = '/__gemigo/favicon.svg';

const escape = (text: string): string => text.replace(/[&<>"']/g, value => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[value]!);

export const faviconFallback = (name: string): Response => {
  const printable = Array.from(name).filter(character => character.codePointAt(0)! >= 32 && character !== '\u007f').join('');
  const initial = Array.from(printable.trim().normalize('NFC'))[0]?.toLocaleUpperCase() || 'G';
  const body = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#6366f1"/><text x="32" y="35" text-anchor="middle" dominant-baseline="middle" font-family="system-ui,sans-serif" font-size="42" font-weight="bold" fill="white">${escape(initial)}</text></svg>`;
  return new Response(body, { headers: {
    'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'no-cache',
    'x-content-type-options': 'nosniff', 'x-gemigo-favicon': 'fallback',
  } });
};

/** Streaming injection: all author markup and R2 objects remain intact. */
export const addSmartFavicon = (rewriter: HTMLRewriter, response: Response, origin: string): HTMLRewriter => {
  let restricted = response.headers.has('content-security-policy'), hasIcon = false, title = '';
  return rewriter
    .on('meta[http-equiv]', { element(element) {
      if (element.getAttribute('http-equiv')?.toLowerCase() === 'content-security-policy') restricted = true;
    } })
    .on('title', { text(chunk) { title = (title + chunk.text).slice(0, 160); } })
    .on('link[rel]', { element(element) {
      if (element.getAttribute('rel')?.toLowerCase().split(/\s+/).includes('icon')) hasIcon = true;
    } })
    .on('head', { element(element) {
      element.onEndTag(end => {
        if (!restricted && !hasIcon) {
          const href = `${origin}${SMART_FAVICON_FALLBACK_PATH}?name=${encodeURIComponent(title.trim())}`;
          end.before(`<link rel="icon" data-gemigo-favicon href="${escape(href)}">`, { html: true });
        }
      });
    } })
    .onDocument({ end(end) {
      if (!restricted) end.append(`<script defer src="${origin}${SMART_FAVICON_PATH}" data-gemigo-favicon-runtime></script>`, { html: true });
    } });
};
