/**
 * Extract Messages
 */

import type { MessageHandlerMap } from '../types';

export const extractMessages: MessageHandlerMap = {
  EXTRACT_ARTICLE: () => {
    try {
      const title = document.title || document.querySelector('h1')?.textContent || '';
      const articleSelectors = ['article', 'main', '.article', '.post', '.content', '#content'];
      let content = '';

      for (const selector of articleSelectors) {
        const el = document.querySelector(selector);
        if (el) {
          content = el.textContent?.trim() || '';
          break;
        }
      }
      if (!content) {
        content = document.body.innerText;
      }

      const excerpt = content.slice(0, 300).trim() + (content.length > 300 ? '...' : '');
      return { success: true, title, content, excerpt, url: window.location.href };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  EXTRACT_LINKS: () => {
    try {
      const links: { href: string; text: string; title?: string }[] = [];
      document.querySelectorAll('a[href]').forEach((el) => {
        const anchor = el as HTMLAnchorElement;
        if (anchor.href && !anchor.href.startsWith('javascript:')) {
          links.push({
            href: anchor.href,
            text: anchor.textContent?.trim() || '',
            title: anchor.title || undefined,
          });
        }
      });
      return { success: true, links };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  EXTRACT_IMAGES: () => {
    try {
      const images: { src: string; alt?: string; width?: number; height?: number }[] = [];
      document.querySelectorAll('img[src]').forEach((el) => {
        const img = el as HTMLImageElement;
        if (img.src) {
          images.push({
            src: img.src,
            alt: img.alt || undefined,
            width: img.naturalWidth || undefined,
            height: img.naturalHeight || undefined,
          });
        }
      });
      return { success: true, images };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  QUERY_ELEMENT: (message: { selector: string; limit?: number }) => {
    try {
      const elements = document.querySelectorAll(message.selector);
      const results: { tagName: string; text: string; attributes: Record<string, string> }[] = [];

      elements.forEach((el, index) => {
        if (index >= (message.limit || 100)) return;
        const attrs: Record<string, string> = {};
        for (const attr of el.attributes) {
          attrs[attr.name] = attr.value;
        }
        results.push({
          tagName: el.tagName.toLowerCase(),
          text: el.textContent?.trim().slice(0, 200) || '',
          attributes: attrs,
        });
      });

      return { success: true, elements: results, count: elements.length };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },
};
