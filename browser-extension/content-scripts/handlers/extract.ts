/**
 * Content Extraction Handlers
 */

import type {
    ExtractArticleResult,
    ExtractLinksResult,
    ExtractImagesResult
} from '@gemigo/app-sdk';
import type { ExtractHandlers } from '../types';

export const extractHandlers: ExtractHandlers = {
    extractArticle: async (): Promise<ExtractArticleResult> => {
        try {
            const title = document.title || document.querySelector('h1')?.textContent || '';
            const selectors = ['article', 'main', '.article', '.post', '.content', '#content'];
            let content = '';
            for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el) {
                    content = el.textContent?.trim() || '';
                    break;
                }
            }
            if (!content) content = document.body.innerText;
            const excerpt = content.slice(0, 300).trim() + (content.length > 300 ? '...' : '');
            return { success: true, title, content, excerpt, url: window.location.href };
        } catch (e) {
            return { success: false, error: String(e) };
        }
    },

    extractLinks: async (): Promise<ExtractLinksResult> => {
        try {
            const links: { href: string; text: string }[] = [];
            document.querySelectorAll('a[href]').forEach((el) => {
                const a = el as HTMLAnchorElement;
                if (a.href && !a.href.startsWith('javascript:')) {
                    links.push({ href: a.href, text: a.textContent?.trim() || '' });
                }
            });
            return { success: true, links };
        } catch (e) {
            return { success: false, error: String(e) };
        }
    },

    extractImages: async (): Promise<ExtractImagesResult> => {
        try {
            const images: { src: string; alt?: string }[] = [];
            document.querySelectorAll('img[src]').forEach((el) => {
                const img = el as HTMLImageElement;
                if (img.src) images.push({ src: img.src, alt: img.alt || undefined });
            });
            return { success: true, images };
        } catch (e) {
            return { success: false, error: String(e) };
        }
    },
};
