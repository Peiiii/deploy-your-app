/**
 * Page Read Host Methods
 * 
 * Read-only methods for getting page content.
 * These don't require special permissions.
 */

import { sendMessage, executeInPage, getPageInfo as getPageInfoMsg } from '../utils/messaging';

export const createPageReadMethods = () => ({
  async getPageInfo() {
    return getPageInfoMsg<{ url: string; title: string; favIconUrl?: string }>();
  },

  async getPageHTML() {
    const response = await executeInPage<{ html?: string }>('GET_PAGE_HTML');
    return response?.html || '';
  },

  async getPageText() {
    const response = await executeInPage<{ text?: string }>('GET_PAGE_TEXT');
    return response?.text || '';
  },

  async getSelection() {
    const response = await executeInPage<{
      text?: string;
      rect?: { x: number; y: number; width: number; height: number } | null;
    }>('GET_SELECTION');
    return { text: response?.text || '', rect: response?.rect || null };
  },

  async extractArticle() {
    return executeInPage<{
      success: boolean;
      title?: string;
      content?: string;
      excerpt?: string;
      url?: string;
      error?: string;
    }>('EXTRACT_ARTICLE');
  },

  async extractLinks() {
    return executeInPage<{
      success: boolean;
      links?: Array<{ href: string; text: string }>;
      error?: string;
    }>('EXTRACT_LINKS');
  },

  async extractImages() {
    return executeInPage<{
      success: boolean;
      images?: Array<{ src: string; alt?: string }>;
      error?: string;
    }>('EXTRACT_IMAGES');
  },

  async queryElement(selector: string, limit?: number) {
    return executeInPage<{
      success: boolean;
      elements?: Array<{ tagName: string; text: string; attributes: Record<string, string> }>;
      count?: number;
      error?: string;
    }>('QUERY_ELEMENT', { selector, limit });
  },
});
