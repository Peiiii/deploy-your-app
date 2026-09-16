import { collect, parseBatch, makeServerEvent, type EventBatch, type EventName } from '@gemigo/product-analytics';
import type { ApiWorkerEnv } from './types/env';
import { getSessionIdFromRequest } from './utils/auth';
import { authRepository } from './repositories/auth.repository';
import { configService } from './services/config.service';

const allowedOrigin = (request: Request) => {
  const origin = request.headers.get('origin');
  return origin === 'https://gemigo.io' || origin === 'http://localhost:5173';
};
export const readTelemetry = async (request: Request): Promise<EventBatch | null> => {
  if (!allowedOrigin(request) && request.headers.get('sec-fetch-site') !== 'same-origin') return null;
  const standalone = new URL(request.url).pathname === '/api/v1/telemetry';
  const raw = standalone ? await request.text() : request.headers.get('x-gemigo-events');
  if (!raw || raw.length > 12000) return null;
  try { return parseBatch(JSON.parse(raw)); } catch { return null; }
};
export const storeTelemetry = async (request: Request, response: Response, env: ApiWorkerEnv, batch: EventBatch) => {
  if (!env.ANALYTICS_DB) return;
  const path = new URL(request.url).pathname;
  const sessionId = getSessionIdFromRequest(request);
  const session = sessionId ? await authRepository.getSessionWithUser(env.PROJECTS_DB, sessionId) : null;
  const success = response.status >= 200 && response.status < 300;
  let event: EventName | undefined;
  if (request.method === 'POST') {
    if (path === '/api/v1/projects/draft' && success) event = 'project_created';
    if (path === '/api/v1/deploy') event = success ? 'deployment_accepted' : 'deployment_rejected';
    if (path === '/api/v1/auth/email/login' && success) event = 'login_success';
    if (path === '/api/v1/auth/email/signup' && success) event = 'signup_success';
  }
  if (event) batch.events.push(makeServerEvent(event, batch.events[batch.events.length - 1]?.page || (path.includes('auth') ? 'other' : 'project')));
  await collect(env.ANALYTICS_DB, batch, { signedIn: Boolean(session) || event === 'login_success' || event === 'signup_success', admin: Boolean(session && configService.isAdminUser(session.user, env)) }, path === '/api/v1/telemetry' ? 'standalone' : 'piggyback');
};
