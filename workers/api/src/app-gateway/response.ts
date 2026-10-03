import { jsonResponse } from '../utils/http';
export function gatewayJson(body: unknown, status = 200): Response {
  const response = jsonResponse(body, status);
  response.headers.set('cache-control', 'no-store');
  response.headers.set('x-content-type-options', 'nosniff');
  return response;
}
