/**
 * Extension API Implementation
 * 
 * Browser extension specific APIs for page interaction.
 */

import { getHost, on } from '../core';
import type { ContextMenuEvent, ContextMenuEventResult, CaptureResult } from '../types';

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

  // ========== Page Manipulation ==========

  /**
   * Highlight elements matching selector
   */
  highlight: (selector: string, color?: string) =>
    getHost().then(host => host.highlight(selector, color)),

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
