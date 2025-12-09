export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}

export function emptyResponse(status = 204): Response {
  return new Response(null, {
    status,
    headers: CORS_HEADERS,
  });
}

export function normalizePath(pathname: string): string {
  if (pathname === '/') return pathname;
  return pathname.replace(/\/+$/, '');
}

export function withSetCookie(response: Response, cookie: string): Response {
  const headers = new Headers(response.headers);
  headers.append('Set-Cookie', cookie);
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

export type JsonBody = Record<string, unknown>;

export async function readJson(req: Request): Promise<JsonBody> {
  const contentType = req.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  // If the request declares a non-JSON content type but has a body,
  // treat this as a protocol error for our API.
  if (!isJson) {
    const contentLength = req.headers.get('content-length');
    if (contentLength !== null && contentLength !== '0') {
      throw new Error('Expected application/json request');
    }
    // No JSON body expected; return an empty object.
    return {};
  }

  // For JSON requests, always attempt to parse the body, regardless of
  // whether a Content-Length header is present. This ensures that
  // Worker-to-Worker fetch() calls (which may use chunked encoding)
  // are handled correctly.
  try {
    const data = (await req.json()) as JsonBody;
    return data;
  } catch {
    throw new Error('Invalid JSON body');
  }
}
