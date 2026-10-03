import { authRepository } from '../repositories/auth.repository';
import { sdkAuthRepository } from '../repositories/sdk-auth.repository';
import { getSessionIdFromRequest } from '../utils/auth';
import { AppError } from '../utils/error-handler';
import type { ApiWorkerEnv } from '../types/env';

export async function platformUser(request: Request, env: ApiWorkerEnv, db: D1Database) {
  if (
    request.method !== 'GET' &&
    request.headers.get('origin') !== new URL(env.AUTH_REDIRECT_BASE || 'https://gemigo.io').origin
  )
    throw new AppError('请从平台页面执行此操作。', 403, 'SOURCE_MISMATCH');
  const id = getSessionIdFromRequest(request);
  const session = id ? await authRepository.getSessionWithUser(db, id) : null;
  if (!session) throw new AppError('请先登录 GemiGo。', 401, 'LOGIN_REQUIRED');
  return session.user;
}
export async function verifiedProject(db: D1Database, appId: string, origin: string) {
  const project = await db
    .prepare(
      "SELECT id,slug,name,owner_id,url FROM projects WHERE slug=? AND status='Live' AND COALESCE(is_deleted,0)=0"
    )
    .bind(appId)
    .first<{ id: string; slug: string; name: string; owner_id: string; url: string }>();
  if (!project?.owner_id || !project.url || new URL(project.url).origin !== origin)
    throw new AppError('应用来源与当前部署不一致。', 403, 'SOURCE_MISMATCH');
  return project;
}
export async function sdkIdentity(request: Request, db: D1Database) {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  const access = token ? await sdkAuthRepository.findAccessToken(db, token) : null;
  if (
    !access ||
    Date.parse(access.expiresAt) <= Date.now() ||
    !access.scopes.includes('points:use')
  )
    throw new AppError('请重新登录并授权点数接入。', 401, 'POINTS_SCOPE_REQUIRED');
  const origin = request.headers.get('origin') || '';
  const project = await verifiedProject(db, access.appId, origin);
  const mapping = await db
    .prepare('SELECT user_id FROM sdk_app_users WHERE app_id=? AND app_user_id=?')
    .bind(access.appId, access.appUserId)
    .first<{ user_id: string }>();
  if (!mapping) throw new AppError('应用身份已失效。', 401, 'LOGIN_REQUIRED');
  return { userId: mapping.user_id, project, origin };
}
export function textInput(value: unknown, name: string, max = 100) {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new AppError(`${name} 格式不正确。`, 400, 'INVALID_INPUT');
  return value.trim();
}
export function integerInput(value: unknown, name: string, min: number, max: number) {
  if (!Number.isSafeInteger(value) || Number(value) < min || Number(value) > max)
    throw new AppError(`${name} 超出允许范围。`, 400, 'INVALID_INPUT');
  return Number(value);
}
