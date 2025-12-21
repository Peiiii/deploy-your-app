/**
 * Capture Host Methods
 * 
 * Screenshot capture methods.
 * Require 'extension.capture' permission.
 */

import { captureVisible as captureVisibleMsg } from '../utils/messaging';
import { hasPermission } from '../utils/permissions';
import type { AppConfig } from '../types';

export const createCaptureMethods = (app: AppConfig) => ({
  async captureVisible() {
    if (!hasPermission(app, 'extension.capture')) {
      return { success: false, error: 'PERMISSION_DENIED' };
    }
    try {
      return await captureVisibleMsg<{
        success: boolean;
        dataUrl?: string;
        error?: string;
      }>();
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
});
