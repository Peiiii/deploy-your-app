/**
 * Fallback Network Implementation
 *
 * Uses browser fetch when no host is available.
 * Note: Will be blocked by CORS in most cases.
 */

import type { NetworkAPI, RequestOptions, RequestResponse } from '../types';

const fallbackRequest = async <T>(
  url: string,
  options?: RequestOptions
): Promise<RequestResponse<T>> => {
  const { method = 'GET', headers: reqHeaders, body, responseType } = options ?? {};

  const response = await fetch(url, {
    method,
    headers: reqHeaders,
    body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  });

  const headers: Record<string, string> = {};
  response.headers.forEach((v, k) => (headers[k] = v));

  const data: T =
    responseType === 'text'
      ? ((await response.text()) as T)
      : responseType === 'arraybuffer'
        ? ((await response.arrayBuffer()) as T)
        : ((await response.json()) as T);

  return { status: response.status, data, headers };
};

export const fallbackNetwork: NetworkAPI = {
  request: fallbackRequest,
};
