/**
 * Extension API Implementation
 * 
 * Browser extension specific APIs for page interaction.
 */

import { getHost, on } from '../core';
import type { ContextMenuEvent, ContextMenuEventResult, CaptureResult } from '../types';

/** Widget insertion result */
export interface WidgetResult {
  success: boolean;
  widgetId?: string;
  error?: string;
}

/** CSS injection result */
export interface CSSResult {
  success: boolean;
  styleId?: string;
  error?: string;
}

/** Highlight result with cleanup ID */
export interface HighlightResult {
  success: boolean;
  count?: number;
  highlightId?: string;
}

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
  insertWidget: (html: string, position: string | { x: number; y: number } = 'bottom-right'): Promise<WidgetResult> =>
    getHost().then(host => host.insertWidget({ html, position })),

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
   * @returns Result with styleId for cleanup
   */
  injectCSS: (css: string): Promise<CSSResult> =>
    getHost().then(host => host.injectCSS(css)),

  /**
   * Remove injected CSS by ID
   */
  removeCSS: (styleId: string): Promise<{ success: boolean }> =>
    getHost().then(host => host.removeCSS(styleId)),

  // ========== Page Data Extraction ==========

  /**
   * Extract all links from the page
   */
  extractLinks: () =>
    getHost().then(host => host.extractLinks()),

  /**
   * Extract all images from the page
   */
  extractImages: () =>
    getHost().then(host => host.extractImages()),

  /**
   * Query elements by CSS selector
   * @param selector - CSS selector
   * @param limit - Max number of results (default 100)
   */
  queryElement: (selector: string, limit?: number) =>
    getHost().then(host => host.queryElement(selector, limit)),

  // ========== Screenshots ==========

  /**
   * Capture visible area
   */
  captureVisible: (): Promise<CaptureResult> =>
    getHost().then(host => host.captureVisible()),

  // ========== Context Menu ==========

  /**
   * Get pending context menu event
   */
  getContextMenuEvent: (): Promise<ContextMenuEventResult> =>
    getHost().then(host => host.getContextMenuEvent()),

  /**
   * Register context menu event handler
   */
  onContextMenu: (handler: (event: ContextMenuEvent) => void): (() => void) => {
    getHost(); // Ensure connection starts
    return on('contextMenu', handler);
  },
};

