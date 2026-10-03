import type { ApiWorkerEnv } from '../types/env';
import { jsonResponse } from '../utils/http';
import { UnauthorizedError, ValidationError } from '../utils/error-handler';
import { getSessionIdFromRequest } from '../utils/auth';
import { authRepository } from '../repositories/auth.repository';
import { configService } from '../services/config.service';
import { feedRequest, type FeedInput } from './service';
import { settings, cleanup } from './repository';
import { indexPending } from './indexer';
import { recommendationReport } from './report';

function privateResponse(body: unknown) {
  const response = jsonResponse(body);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Vary', 'Cookie, DNT');
  return response;
}
async function inputBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.includes('application/json'))
    throw new ValidationError('Expected JSON');
  const raw = await request.text();
  if (raw.length > 80000) throw new ValidationError('Request too large');
  let value: Record<string, unknown>;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new ValidationError('Invalid JSON');
  }
  if (!value || Array.isArray(value) || typeof value !== 'object')
    throw new ValidationError('Invalid JSON');
  return value;
}
export async function handleFeed(request: Request, env: ApiWorkerEnv) {
  const started = performance.now();
  let previous = started;
  const stages: string[] = [];
  const response = privateResponse(
    await feedRequest(request, env, (await inputBody(request)) as FeedInput, (name) => {
      const now = performance.now();
      stages.push(`${name};dur=${(now - previous).toFixed(1)}`);
      previous = now;
    })
  );
  response.headers.set(
    'Server-Timing',
    `recommendation;dur=${(performance.now() - started).toFixed(1)},${stages.join(',')}`
  );
  return response;
}
export async function handleRecommendationOperations(request: Request, env: ApiWorkerEnv) {
  const operational =
    request.headers.get('authorization') === `Bearer ${env.RECOMMENDATION_SECRET}` &&
    !!env.RECOMMENDATION_SECRET;
  if (!operational) {
    const session = getSessionIdFromRequest(request);
    const user = session ? await authRepository.getSessionWithUser(env.PROJECTS_DB, session) : null;
    if (!user || !configService.isAdminUser(user.user, env))
      throw new UnauthorizedError('Admin access required');
  }
  const input = await inputBody(request);
  const db = env.PROJECTS_DB;
  if (input.action === 'configure') {
    const old = await settings(db);
    const enabled =
      input.enabled === undefined
        ? old.enabled
        : input.enabled === true
          ? 1
          : input.enabled === false
            ? 0
            : -1;
    const percent = input.percent === undefined ? old.percent : input.percent;
    const ranker = input.ranker === undefined ? old.ranker : input.ranker;
    const experiment = input.experiment === undefined ? old.experiment : input.experiment;
    if (
      enabled < 0 ||
      !Number.isInteger(percent) ||
      Number(percent) < 0 ||
      Number(percent) > 100 ||
      !['bge', 'content'].includes(String(ranker)) ||
      typeof experiment !== 'string' ||
      !/^[a-zA-Z0-9-]{1,40}$/.test(experiment)
    )
      throw new ValidationError('Invalid experiment configuration');
    await db
      .prepare(
        'UPDATE explore_rec_settings SET enabled=?,percent=?,ranker=?,experiment=? WHERE id=1'
      )
      .bind(enabled, percent, ranker, experiment)
      .run();
    return privateResponse(await settings(db));
  }
  if (input.action === 'index') return privateResponse(await indexPending(env, 32));
  if (input.action === 'cleanup') {
    await cleanup(db);
    return privateResponse({ cleaned: true });
  }
  if (input.action !== 'report' && input.action !== 'status')
    throw new ValidationError('Invalid operation');
  return privateResponse(await recommendationReport(db));
}
