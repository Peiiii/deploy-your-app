import { normalizePublicLabel, normalizePublicHandle } from '@gemigo/public-author';
import { authRepository } from '../repositories/auth.repository';
import { sdkAuthRepository } from '../repositories/sdk-auth.repository';
import { verifiedProject, platformUser } from '../points/identity';
import {
  sdkAuthService,
  requireAppId,
  requireCodeChallenge,
  normalizeAuthorizationScopes,
} from './sdk-auth.service';
import { getSessionIdFromRequest } from '../utils/auth';
import { ValidationError } from '../utils/error-handler';
import type { ApiWorkerEnv } from '../types/env';

type AuthRequest = {
  id: string;
  app_id: string;
  source_origin: string;
  redirect_uri: string;
  mode: 'popup' | 'redirect';
  scopes: string;
  code_challenge: string;
  state: string;
  expires_at: string;
  used_at: string | null;
};
const REQUEST_TTL_MS = 10 * 60 * 1000;

function requireRequestId(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new ValidationError('Invalid authorization request');
  return id;
}
async function publicContext(
  request: Request,
  db: D1Database,
  appId: string,
  origin: string,
  scopes: string[]
) {
  const project = await verifiedProject(db, appId, origin);
  const owner = await authRepository.findUserById(db, project.owner_id);
  const sessionId = getSessionIdFromRequest(request);
  const session = sessionId ? await authRepository.getSessionWithUser(db, sessionId) : null;
  const consent = session
    ? await sdkAuthRepository.findConsent(db, { appId, userId: session.user.id })
    : null;
  return {
    appId,
    name: project.name,
    origin,
    provider:
      normalizePublicLabel(owner?.displayName) ||
      normalizePublicHandle(owner?.handle) ||
      '应用开发者',
    scopes,
    previouslyGranted: Boolean(
      consent && !consent.revokedAt && scopes.every((scope) => consent.scopes.includes(scope))
    ),
  };
}
async function findRequest(db: D1Database, id: string): Promise<AuthRequest> {
  const row = await db
    .prepare('SELECT * FROM sdk_auth_requests WHERE id=?')
    .bind(requireRequestId(id))
    .first<AuthRequest>();
  if (!row || row.used_at || row.expires_at <= new Date().toISOString())
    throw new ValidationError('授权请求已过期或已使用，请返回应用重新登录。');
  // Recheck deployment; URLs can change after the request was created.
  const project = await verifiedProject(db, row.app_id, row.source_origin);
  if (new URL(project.url).href !== row.redirect_uri)
    throw new ValidationError('应用地址已变更，请重新登录。');
  return row;
}
export const sdkAuthRequestService = {
  async create(request: Request, env: ApiWorkerEnv, db: D1Database, body: Record<string, unknown>) {
    const appId = requireAppId(body.appId);
    const origin = request.headers.get('origin') || '';
    const project = await verifiedProject(db, appId, origin);
    const scopes = normalizeAuthorizationScopes(body.scopes);
    const codeChallenge = requireCodeChallenge(body.codeChallenge);
    const redirectUri = new URL(project.url).href;
    if (body.redirectUri !== redirectUri)
      throw new ValidationError('Return URL must match the registered app URL');
    if (body.mode !== 'popup' && body.mode !== 'redirect')
      throw new ValidationError('Invalid display mode');
    if (typeof body.state !== 'string' || !/^[A-Za-z0-9_-]{22,128}$/.test(body.state))
      throw new ValidationError('Invalid state');
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + REQUEST_TTL_MS).toISOString();
    const id = crypto.randomUUID();
    await db
      .prepare(
        'DELETE FROM sdk_auth_requests WHERE id IN (SELECT id FROM sdk_auth_requests WHERE expires_at<=? LIMIT 500)'
      )
      .bind(now)
      .run();
    const inserted = await db
      .prepare(
        `INSERT INTO sdk_auth_requests
      (id,app_id,source_origin,redirect_uri,mode,scopes,code_challenge,state,created_at,expires_at)
      SELECT ?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM sdk_auth_requests WHERE app_id=? AND expires_at>? AND used_at IS NULL)<1000 RETURNING id`
      )
      .bind(
        id,
        appId,
        origin,
        redirectUri,
        body.mode,
        JSON.stringify(scopes),
        codeChallenge,
        body.state,
        now,
        expiresAt,
        appId,
        now
      )
      .first();
    if (!inserted) throw new ValidationError('Too many pending logins; please retry later');
    const url = new URL('/auth/authorize', env.AUTH_REDIRECT_BASE || 'https://gemigo.io');
    url.searchParams.set('request', id);
    return { authorizationUrl: url.href, expiresIn: REQUEST_TTL_MS / 1000 };
  },
  async context(request: Request, db: D1Database, id: string) {
    const row = await findRequest(db, id);
    return {
      ...(await publicContext(request, db, row.app_id, row.source_origin, JSON.parse(row.scopes))),
      mode: row.mode,
      state: row.state,
      redirectUri: row.redirect_uri,
    };
  },
  async legacyContext(request: Request, db: D1Database) {
    const params = new URL(request.url).searchParams;
    return publicContext(
      request,
      db,
      requireAppId(params.get('app_id')),
      params.get('origin') || '',
      normalizeAuthorizationScopes(params.get('scope'))
    );
  },
  async authorize(request: Request, env: ApiWorkerEnv, db: D1Database, id: string) {
    await platformUser(request, env, db);
    const row = await findRequest(db, id);
    const claimed = await db
      .prepare(
        'UPDATE sdk_auth_requests SET used_at=? WHERE id=? AND used_at IS NULL AND expires_at>? RETURNING id'
      )
      .bind(new Date().toISOString(), row.id, new Date().toISOString())
      .first();
    if (!claimed) throw new ValidationError('授权请求已使用，请返回应用重新登录。');
    return sdkAuthService.authorize(request, env, db, {
      appId: row.app_id,
      scopes: JSON.parse(row.scopes),
      codeChallenge: row.code_challenge,
      openerOrigin: row.source_origin,
    });
  },
};
