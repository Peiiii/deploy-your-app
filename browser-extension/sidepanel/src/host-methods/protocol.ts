/**
 * Protocol Host Methods
 * 
 * SDK handshake and capability discovery.
 */

import { hasPermission } from '../utils/permissions';
import type { AppConfig } from '../types';

export const createProtocolMethods = (app: AppConfig) => ({
  async getProtocolInfo() {
    const canModify = hasPermission(app, 'extension.modify');
    const canCapture = hasPermission(app, 'extension.capture');
    const canNetwork =
      hasPermission(app, 'network') && (app.networkAllowlist?.length ?? 0) > 0;

    return {
      protocolVersion: 1,
      platform: 'extension' as const,
      appId: app.id,
      capabilities: {
        storage: true,
        network: canNetwork,
        scheduler: false,
        fileWatch: false,
        fileWrite: false,
        notification: true,
        clipboard: false,
        ai: false,
        shell: false,
        extension: {
          read: true,
          events: true,
          modify: canModify,
          capture: canCapture,
        },
      },
    };
  },
});
