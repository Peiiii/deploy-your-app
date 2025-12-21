/**
 * Extension API Implementation
 * 
 * Browser extension specific APIs for page interaction.
 */

import { getHost, on } from '../core';
import type {
  ContextMenuEvent,
  HighlightResult,
  WidgetResult,
  WidgetPosition,
} from '../types';

/**
 * Extension API object
 */
export const extensionAPI = {
  // ========== Page Content Reading ==========

  /**
   * Get current page info
   */
  getPageInfo: () => getHost().then(host => host.getPageInfo()),

  /**
   * Get full page HTML
   */
  getPageHTML: () => getHost().then(host => host.getPageHTML()),

  /**
   * Get page text content
   */
  getPageText: () => getHost().then(host => host.getPageText()),

  /**
   * Get selected text
   */
  getSelection: () => getHost().then(host => host.getSelection()),

  /**
   * Extract article content
   */
  extractArticle: () => getHost().then(host => host.extractArticle()),

  // ========== Page Manipulation - Highlight ==========

  /**
   * Highlight elements matching selector
   * @returns Result with highlightId for cleanup
   */
  highlight: (selector: string, color?: string): Promise<HighlightResult> =>
    getHost().then(host => host.highlight(selector, color)),

  /**
   * Remove highlight by ID
   */
  removeHighlight: (highlightId: string): Promise<{ success: boolean }> =>
    getHost().then(host => host.removeHighlight(highlightId)),

  // ========== Page Manipulation - Widget ==========

  /**
   * Insert a widget (floating element) in the page
   * @param html - HTML content of the widget
   * @param position - 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | { x, y }
   */
  insertWidget: (html: string, position?: string | WidgetPosition): Promise<WidgetResult> =>
    getHost().then(host => host.insertWidget(html, position)),

  /**
   * Update widget content
   */
  updateWidget: (widgetId: string, html: string): Promise<{ success: boolean; error?: string }> =>
    getHost().then(host => host.updateWidget(widgetId, html)),

  /**
   * Remove a widget
   */
  removeWidget: (widgetId: string): Promise<{ success: boolean }> =>
    getHost().then(host => host.removeWidget(widgetId)),

  // ========== Page Manipulation - CSS ==========

  /**
   * Inject CSS into the page
   */
  injectCSS: (css: string) => getHost().then(host => host.injectCSS(css)),

  /**
   * Remove injected CSS
   */
  removeCSS: (styleId: string) => getHost().then(host => host.removeCSS(styleId)),

  // ========== Page Data Extraction ==========

  /**
   * Extract all links from page
   */
  extractLinks: () => getHost().then(host => host.extractLinks()),

  /**
   * Extract all images from page
   */
  extractImages: () => getHost().then(host => host.extractImages()),

  /**
   * Query elements by selector
   */
  queryElement: (selector: string, limit?: number) =>
    getHost().then(host => host.queryElement(selector, limit)),

  // ========== Screenshot ==========

  /**
   * Capture visible area as screenshot
   */
  captureVisible: () => getHost().then(host => host.captureVisible()),

  // ========== Context Menu ==========

  /**
   * Get pending context menu event
   */
  getContextMenuEvent: () => getHost().then(host => host.getContextMenuEvent()),

  /**
   * Register context menu event handler
   */
  onContextMenu: (callback: (event: ContextMenuEvent) => void): (() => void) => {
    getHost(); // Ensure connection
    return on('contextMenu', callback);
  },

  /**
   * Register selection change handler
   */
  onSelectionChange: (
    handler: (text: string, rect: { x: number; y: number; width: number; height: number } | null, url?: string) => void,
  ): (() => void) => {
    getHost(); // Ensure connection
    return on('selectionChange', handler);
  },
};
