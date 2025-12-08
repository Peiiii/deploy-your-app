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
  if (
    !req.headers.get('content-type')?.includes('application/json') &&
    req.headers.get('content-length')
  ) {
    throw new Error('Expected application/json request');
  }

  if (req.headers.get('content-length') === null) {
    return {};
  }

  try {
    const data = (await req.json()) as JsonBody;
    return data;
  } catch {
    throw new Error('Invalid JSON body');
  }
}
