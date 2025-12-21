/**
 * Network API
 *
 * Proxy to host network capability.
 */

import { callHost } from '../core';
import type { NetworkAPI } from '../types';

export const networkAPI: NetworkAPI = {
  request: async (url, options) => {
    // callHost will return the raw result object from host if it has no .data property,
    // or if the host returned the whole object as success value.
    // In our case, handleNetworkRequest returns { success, status, headers, data }.
    // callHost will return { status, headers, data } since data is present but it's part of the success object.
    const res = await callHost<any>('networkRequest', [url, options]);
    
    return {
      status: res?.status ?? 0,
      data: res?.data ?? null,
      headers: res?.headers ?? {},
    };
  },
};
