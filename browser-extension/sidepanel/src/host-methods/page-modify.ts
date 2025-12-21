/**
 * Page Modify Host Methods
 * 
 * Methods that modify page content.
 * Require 'extension.modify' permission.
 */

import { executeInPage } from '../utils/messaging';
import { hasPermission } from '../utils/permissions';
import type { AppConfig } from '../types';

const PERMISSION_DENIED = { success: false, error: 'PERMISSION_DENIED' };

export const createPageModifyMethods = (app: AppConfig) => ({
  async highlight(selector: string, color?: string) {
    if (!hasPermission(app, 'extension.modify')) {
      return PERMISSION_DENIED;
    }
    return executeInPage<{
      success: boolean;
      count?: number;
      highlightId?: string;
      error?: string;
    }>('HIGHLIGHT_ELEMENT', { selector, color });
  },

  async removeHighlight(highlightId: string) {
    if (!hasPermission(app, 'extension.modify')) {
      return PERMISSION_DENIED;
    }
    return executeInPage<{ success: boolean; error?: string }>('REMOVE_HIGHLIGHT', { highlightId });
  },

  async insertWidget(html: string, position?: string | { x: number; y: number }) {
    if (!hasPermission(app, 'extension.modify')) {
      return PERMISSION_DENIED;
    }
    return executeInPage<{
      success: boolean;
      widgetId?: string;
      error?: string;
    }>('INSERT_WIDGET', { html, position: position ?? 'bottom-right' });
  },

  async updateWidget(widgetId: string, html: string) {
    if (!hasPermission(app, 'extension.modify')) {
      return PERMISSION_DENIED;
    }
    return executeInPage<{ success: boolean; error?: string }>('UPDATE_WIDGET', { widgetId, html });
  },

  async removeWidget(widgetId: string) {
    if (!hasPermission(app, 'extension.modify')) {
      return PERMISSION_DENIED;
    }
    return executeInPage<{ success: boolean; error?: string }>('REMOVE_WIDGET', { widgetId });
  },

  async injectCSS(css: string) {
    if (!hasPermission(app, 'extension.modify')) {
      return PERMISSION_DENIED;
    }
    return executeInPage<{
      success: boolean;
      styleId?: string;
      error?: string;
    }>('INJECT_CSS', { css });
  },

  async removeCSS(styleId: string) {
    if (!hasPermission(app, 'extension.modify')) {
      return PERMISSION_DENIED;
    }
    return executeInPage<{ success: boolean; error?: string }>('REMOVE_CSS', { styleId });
  },
});
