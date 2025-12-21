/**
 * Capture Host Methods
 * 
 * Screenshot capture methods.
 * Require 'extension.capture' permission.
 */

import { captureVisible as captureVisibleMsg } from '../../utils/messaging';
import { requirePermission, fail } from '../../utils/response';
import type { AppConfig } from '../../types';

export const createCaptureMethods = (app: AppConfig) => ({
  async captureVisible() {
    const denied = requirePermission(app, 'extension.capture');
    if (denied) return denied;

    try {
      return await captureVisibleMsg<{
        success: boolean;
        dataUrl?: string;
        error?: string;
      }>();
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
});
