/**
 * Network API Implementation
 *
 * Cross-origin HTTP requests via host proxy.
 * Only available in extension platform.
 */

import { getHost } from '../core';
import { state, ensureExtensionProtocol, throwNotSupported, SDKError } from './platform';
import type { NetworkAPI } from '../types';

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
    if (state.platform !== 'extension') {
      return throwNotSupported('network.request');
    }

    const protocol = await ensureExtensionProtocol();
    if (!protocol.capabilities.network) {
      throw new SDKError('PERMISSION_DENIED', 'Network capability is not granted.');
    }

    const host = await getHost();
    if (typeof host.networkRequest !== 'function') {
      return throwNotSupported('network.request');
    }

    const res = await host.networkRequest({ url, options });
    if (!res.success) {
      const code =
        res.code === 'NETWORK_NOT_ALLOWED'
          ? 'NETWORK_NOT_ALLOWED'
          : res.code === 'PERMISSION_DENIED'
            ? 'PERMISSION_DENIED'
            : 'INTERNAL_ERROR';
      throw new SDKError(code, res.error || 'Network request failed.');
    }

    return {
      status: res.status ?? 0,
      data: (res.data ?? null) as T,
      headers: res.headers ?? {},
    };
  },
};
