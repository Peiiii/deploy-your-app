/**
 * Network API types
 */

/** HTTP request method */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

/** Response type */
export type ResponseType = 'json' | 'text' | 'arraybuffer';

/** Request options */
export interface RequestOptions {
  /** HTTP method */
  method?: HttpMethod;
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body */
  body?: string | object;
  /** Response type */
  responseType?: ResponseType;
}

/** Request response */
export interface RequestResponse<T = unknown> {
  /** HTTP status code */
  status: number;
  /** Response data */
  data: T;
  /** Response headers */
  headers: Record<string, string>;
}

/** Network API for cross-origin HTTP requests */
export interface NetworkAPI {
  /**
   * Make an HTTP request (bypasses CORS restrictions)
   * @param url - Request URL
   * @param options - Request options
   * @returns Response with status, data, and headers
   */
  request<T = unknown>(url: string, options?: RequestOptions): Promise<RequestResponse<T>>;
}
