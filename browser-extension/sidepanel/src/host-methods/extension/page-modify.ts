/**
 * Page Modify Host Methods
 * 
 * Methods that modify page content.
 * Require 'extension.modify' permission.
 */

import { executeInPage } from '../../utils/messaging';
import { requirePermission } from '../../utils/response';
import type { AppConfig } from '../../types';

export const createPageModifyMethods = (app: AppConfig) => ({
  async highlight(selector: string, color?: string) {
    const denied = requirePermission(app, 'extension.modify');
    if (denied) return denied;

    return executeInPage<{
      success: boolean;
      count?: number;
      highlightId?: string;
      error?: string;
    }>('HIGHLIGHT_ELEMENT', { selector, color });
  },

  async removeHighlight(highlightId: string) {
    const denied = requirePermission(app, 'extension.modify');
    if (denied) return denied;

    return executeInPage<{ success: boolean; error?: string }>('REMOVE_HIGHLIGHT', { highlightId });
  },

  async insertWidget(html: string, position?: string | { x: number; y: number }) {
    const denied = requirePermission(app, 'extension.modify');
    if (denied) return denied;

    return executeInPage<{
      success: boolean;
      widgetId?: string;
      error?: string;
    }>('INSERT_WIDGET', { html, position: position ?? 'bottom-right' });
  },

  async updateWidget(widgetId: string, html: string) {
    const denied = requirePermission(app, 'extension.modify');
    if (denied) return denied;

    return executeInPage<{ success: boolean; error?: string }>('UPDATE_WIDGET', { widgetId, html });
  },

  async removeWidget(widgetId: string) {
    const denied = requirePermission(app, 'extension.modify');
    if (denied) return denied;

    return executeInPage<{ success: boolean; error?: string }>('REMOVE_WIDGET', { widgetId });
  },

  async injectCSS(css: string) {
    const denied = requirePermission(app, 'extension.modify');
    if (denied) return denied;

    return executeInPage<{
      success: boolean;
      styleId?: string;
      error?: string;
    }>('INJECT_CSS', { css });
  },

  async removeCSS(styleId: string) {
    const denied = requirePermission(app, 'extension.modify');
    if (denied) return denied;

    return executeInPage<{ success: boolean; error?: string }>('REMOVE_CSS', { styleId });
  },
});
