/**
 * Background Network Handler
 * 
 * Logic for cross-origin network requests.
 */



import type { NetworkHandlers } from '../types';

export const networkHandlers: NetworkHandlers = {
    networkRequest: async (url, options) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), options?.timeoutMs || 30000);

        try {
            const response = await fetch(url, {
                method: options?.method || 'GET',
                headers: options?.headers,
                body: options?.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined,
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            const headers: Record<string, string> = {};
            response.headers.forEach((v, k) => (headers[k] = v));

            let data;
            if (options?.responseType === 'arraybuffer') data = await response.arrayBuffer();
            else if (options?.responseType === 'text') data = await response.text();
            else {
                try { data = await response.json(); }
                catch { data = await response.text(); }
            }
            return { success: true, status: response.status, headers, data };
        } catch (err: any) {
            clearTimeout(timeoutId);
            return {
                success: false,
                code: String(err).includes('AbortError') ? 'TIMEOUT' : 'FETCH_ERROR',
                error: String(err)
            };
        }
    },
};
