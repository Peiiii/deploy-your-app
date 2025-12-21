/**
 * Extension Platform - Network Implementation
 *
 * Uses Host RPC for cross-origin requests.
 */

import { getHost } from './connection';
import type { NetworkAPI } from '../../types';

class SDKError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'SDKError';
  }
}

const throwNotSupported = (feature: string): never => {
  throw new SDKError('NOT_SUPPORTED', `${feature} is not supported.`);
};

export const extensionNetwork: NetworkAPI = {
  request: async <T = unknown>(
    url: string,
    options?: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      headers?: Record<string, string>;
      body?: string | object;
      responseType?: 'json' | 'text' | 'arraybuffer';
    },
  ) => {
    const host = await getHost();
    if (typeof host.networkRequest !== 'function') {
      return throwNotSupported('network.request');
    }

    const res = await host.networkRequest({ url, options });
    if (!res.success) {
      const code = res.code || 'INTERNAL_ERROR';
      throw new SDKError(code, res.error || 'Network request failed.');
    }

    return {
      status: res.status ?? 0,
      data: (res.data ?? null) as T,
      headers: res.headers ?? {},
    };
  },
};
