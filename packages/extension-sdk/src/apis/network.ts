/**
 * Network API
 *
 * Requires host connection. No fallback available.
 */

import { tryGetHost } from '../core';
import type { NetworkAPI } from '../types';

class SDKError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'SDKError';
  }
}

const throwNotSupported = (feature: string): never => {
  throw new SDKError('NOT_SUPPORTED', `${feature} is not supported in this environment.`);
};

export const networkAPI: NetworkAPI = {
  request: async <T = unknown>(
    url: string,
    options?: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      headers?: Record<string, string>;
      body?: string | object;
      responseType?: 'json' | 'text' | 'arraybuffer';
    },
  ) => {
    const host = await tryGetHost();
    if (!host || typeof host.networkRequest !== 'function') {
      return throwNotSupported('network.request');
    }

    const res = await host.networkRequest({ url, options });
    if (!res.success) {
      throw new SDKError(res.code || 'INTERNAL_ERROR', res.error || 'Network request failed.');
    }

    return {
      status: res.status ?? 0,
      data: (res.data ?? null) as T,
      headers: res.headers ?? {},
    };
  },
};
