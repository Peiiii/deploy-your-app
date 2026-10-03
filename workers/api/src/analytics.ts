import { collect, parseBatch, makeServerEvent, type EventBatch, type EventName } from '@gemigo/product-analytics';
import type { ApiWorkerEnv } from './types/env';
import { getSessionIdFromRequest, readOAuthStateCookie } from './utils/auth';
import { authRepository } from './repositories/auth.repository';
import { configService } from './services/config.service';

const allowedOrigin = (request: Request) => {
  const origin = request.headers.get('origin');
  return origin === 'https://gemigo.io' || origin === 'http://localhost:5173';
};
export const readTelemetry = async (request: Request): Promise<EventBatch | null> => {
  const path = new URL(request.url).pathname;
  const callback = /^\/api\/v1\/auth\/(google|github)\/callback$/.exec(path);
  if (callback) return readOAuthStateCookie(request, callback[1] as 'google' | 'github')?.analytics || null;
  if (!allowedOrigin(request) && request.headers.get('sec-fetch-site') !== 'same-origin') return null;
  const standalone = new URL(request.url).pathname === '/api/v1/telemetry';
  const raw = standalone ? await request.text() : request.headers.get('x-gemigo-events');
  if (!raw || raw.length > 12000) return null;
  try { return parseBatch(JSON.parse(raw)); } catch { return null; }
};
export const storeTelemetry = async (request: Request, response: Response, env: ApiWorkerEnv, batch: EventBatch) => {
  if (!env.ANALYTICS_DB) return;
  const path = new URL(request.url).pathname;
  const confirmedSession = /(?:^|[,;]\s*)session_id=([a-f0-9-]{36})/i.exec(response.headers.get('set-cookie') || '')?.[1];
  const sessionId = confirmedSession || getSessionIdFromRequest(request);
  const session = sessionId ? await authRepository.getSessionWithUser(env.PROJECTS_DB, sessionId) : null;
  const success = response.status >= 200 && response.status < 300;
  let event: EventName | undefined;
  if (request.method === 'POST') {
    if (['/api/v1/projects/draft', '/api/v1/projects'].includes(path) && success) event = 'project_created';
    if (path === '/api/v1/deploy') event = success ? 'deployment_accepted' : 'deployment_rejected';
    if (path === '/api/v1/auth/email/login' && success) event = 'login_success';
    if (path === '/api/v1/auth/email/signup' && success && response.headers.get('x-gemigo-auth-result') === 'signup') event = 'signup_success';
  }
  if (/^\/api\/v1\/auth\/(google|github)\/callback$/.test(path) && response.status === 302) {
    const result = response.headers.get('x-gemigo-auth-result');
    if (result === 'signup') event = 'signup_success';
    if (result === 'login') event = 'login_success';
  }
  if (event) {
    const flowId =
      [...batch.events].reverse().find((item) => item.name === 'deployment_start')?.flowId ??
      request.headers.get('x-gemigo-flow-id') ??
      undefined;
    const serverEvent = makeServerEvent(
        event,
        batch.events[batch.events.length - 1]?.page ||
          (path.includes('auth') ? 'other' : 'project'),
        flowId,
      );
    if (event === 'signup_success') serverEvent.dimension = path.includes('/email/') ? 'email' : path.includes('/google/') ? 'google' : 'github';
    batch.events.push(serverEvent);
  }
  await collect(env.ANALYTICS_DB, batch, { signedIn: Boolean(session) || event === 'login_success' || event === 'signup_success', admin: Boolean(session && configService.isAdminUser(session.user, env)) }, path === '/api/v1/telemetry' ? 'standalone' : 'piggyback');
};
