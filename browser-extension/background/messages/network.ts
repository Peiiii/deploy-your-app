/**
 * Network Messages
 */

import type { MessageHandlerMap } from '../types';
import { normalizeHeaders, toBase64, parseBody } from '../utils/network';

interface NetworkRequestPayload {
  url: string;
  options?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string | object;
    responseType?: 'json' | 'text' | 'arraybuffer';
    timeoutMs?: number;
    maxBytes?: number;
  };
}

async function handleNetworkRequest(payload: NetworkRequestPayload) {
  let url: URL;
  try {
    url = new URL(payload.url);
  } catch {
    return { success: false, code: 'INVALID_URL', error: 'Invalid URL.' };
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { success: false, code: 'INVALID_URL', error: 'Only http/https are allowed.' };
  }

  const method = payload.options?.method?.toUpperCase() ?? 'GET';
  const responseType = payload.options?.responseType ?? 'json';
  const timeoutMs = payload.options?.timeoutMs ?? 15_000;
  const maxBytes = payload.options?.maxBytes ?? 2 * 1024 * 1024;

  const headers = normalizeHeaders(payload.options?.headers);
  const { body, headers: finalHeaders } = parseBody(payload.options?.body, headers);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url.toString(), {
      method,
      headers: finalHeaders,
      body,
      signal: controller.signal,
      credentials: 'omit',
      redirect: 'follow',
    });

    const resultHeaders: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      resultHeaders[key] = value;
    });

    const contentLength = Number(res.headers.get('content-length') ?? '0');
    if (contentLength && contentLength > maxBytes) {
      return { success: false, code: 'MAX_BYTES_EXCEEDED', error: `Response too large: ${contentLength} bytes.` };
    }

    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > maxBytes) {
      return { success: false, code: 'MAX_BYTES_EXCEEDED', error: `Response too large: ${buffer.byteLength} bytes.` };
    }

    if (responseType === 'arraybuffer') {
      return { success: true, status: res.status, headers: resultHeaders, data: { encoding: 'base64', data: toBase64(buffer) } };
    }

    const text = new TextDecoder().decode(buffer);
    if (responseType === 'text') {
      return { success: true, status: res.status, headers: resultHeaders, data: text };
    }

    try {
      const json = text.length ? JSON.parse(text) : null;
      return { success: true, status: res.status, headers: resultHeaders, data: json };
    } catch {
      return { success: true, status: res.status, headers: resultHeaders, data: text };
    }
  } catch (err) {
    if (String(err).includes('AbortError')) {
      return { success: false, code: 'TIMEOUT', error: 'Request timed out.' };
    }
    return { success: false, code: 'FETCH_ERROR', error: String(err) };
  } finally {
    clearTimeout(timeoutId);
  }
}

export const networkMessages: MessageHandlerMap = {
  NETWORK_REQUEST: async (message: { payload: NetworkRequestPayload }) => {
    return handleNetworkRequest(message.payload);
  },
};
