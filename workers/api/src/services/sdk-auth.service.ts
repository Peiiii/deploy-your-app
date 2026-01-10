import { sdkAuthRepository } from '../repositories/sdk-auth.repository';
import {
  UnauthorizedError,
  ValidationError,
} from '../utils/error-handler';
import { authRepository } from '../repositories/auth.repository';
import { getSessionIdFromRequest } from '../utils/auth';
import type { ApiWorkerEnv } from '../types/env';
import type {
  SdkAuthorizeResponse,
  SdkMeResponse,
  SdkTokenResponse,
} from '../types/sdk-auth';

const AUTH_CODE_TTL_SECONDS = 60;
const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour (V0)

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  const btoaFn = (globalThis as unknown as { btoa?: (data: string) => string }).btoa;
  if (!btoaFn) {
    throw new Error('base64 encoder is not available in this runtime');
  }
  // btoa expects binary string.
  const base64 = btoaFn(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

function parseScopes(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  }
  if (typeof raw === 'string') {
    return raw
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function requireAppId(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw new ValidationError('appId is required and must be a string');
  }
  const appId = raw.trim();
  if (!appId) throw new ValidationError('appId cannot be empty');
  if (appId.length > 64) throw new ValidationError('appId is too long');
  if (!/^[a-z0-9-]+$/.test(appId)) {
    throw new ValidationError('appId must be lowercase letters/numbers/dashes');
  }
  return appId;
}

function requireCodeChallenge(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw new ValidationError('codeChallenge is required and must be a string');
  }
  const trimmed = raw.trim();
  if (!trimmed) throw new ValidationError('codeChallenge cannot be empty');
  if (trimmed.length > 256) throw new ValidationError('codeChallenge is invalid');
  return trimmed;
}

function requireCodeVerifier(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw new ValidationError('codeVerifier is required and must be a string');
  }
  const trimmed = raw.trim();
  if (!trimmed) throw new ValidationError('codeVerifier cannot be empty');
  if (trimmed.length < 43 || trimmed.length > 128) {
    throw new ValidationError('codeVerifier length is invalid');
  }
  return trimmed;
}

function requireCode(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw new ValidationError('code is required and must be a string');
  }
  const trimmed = raw.trim();
  if (!trimmed) throw new ValidationError('code cannot be empty');
  if (trimmed.length > 128) throw new ValidationError('code is invalid');
  return trimmed;
}

function requireBearerToken(request: Request): string {
  const header = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!header) throw new UnauthorizedError('Missing Authorization header.');
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new UnauthorizedError('Invalid Authorization header.');
  return match[1].trim();
}

class SdkAuthService {
  async authorize(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    input: {
      appId: unknown;
      scopes: unknown;
      codeChallenge: unknown;
    },
  ): Promise<SdkAuthorizeResponse> {
    const sessionId = getSessionIdFromRequest(request);
    if (!sessionId) throw new UnauthorizedError('Login required.');

    const sessionWithUser = await authRepository.getSessionWithUser(db, sessionId);
    if (!sessionWithUser) throw new UnauthorizedError('Login required.');

    const appId = requireAppId(input.appId);
    const requestedScopes = parseScopes(input.scopes);
    const codeChallenge = requireCodeChallenge(input.codeChallenge);

    // V0: minimal scopes; allow additional strings but keep bounded.
    if (requestedScopes.length === 0) {
      requestedScopes.push('identity:basic');
    }
    if (requestedScopes.length > 10) {
      throw new ValidationError('Too many scopes.');
    }

    await sdkAuthRepository.upsertConsent(db, {
      appId,
      userId: sessionWithUser.user.id,
      scopes: requestedScopes,
    });

    // Ensure app-scoped user id exists.
    await sdkAuthRepository.ensureAppUserId(db, {
      appId,
      userId: sessionWithUser.user.id,
    });

    const code = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + AUTH_CODE_TTL_SECONDS * 1000).toISOString();
    await sdkAuthRepository.insertAuthCode(db, {
      code,
      appId,
      userId: sessionWithUser.user.id,
      scopes: requestedScopes,
      codeChallenge,
      expiresAt,
    });

    void env;
    return { code, expiresIn: AUTH_CODE_TTL_SECONDS };
  }

  async exchangeToken(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    input: {
      code: unknown;
      codeVerifier: unknown;
    },
  ): Promise<SdkTokenResponse> {
    void request;
    const code = requireCode(input.code);
    const codeVerifier = requireCodeVerifier(input.codeVerifier);

    // Consume first to prevent parallel exchanges (idempotent-ish).
    const record = await sdkAuthRepository.consumeAuthCode(db, code);
    if (!record) {
      throw new ValidationError('Code already used or invalid.');
    }

    const nowIso = new Date().toISOString();
    if (record.expiresAt <= nowIso) {
      throw new ValidationError('Code expired.');
    }
    const derived = await sha256Base64Url(codeVerifier);
    if (derived !== record.codeChallenge) {
      throw new ValidationError('Invalid codeVerifier.');
    }

    const appUser = await sdkAuthRepository.ensureAppUserId(db, {
      appId: record.appId,
      userId: record.userId,
    });

    const accessToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000).toISOString();
    await sdkAuthRepository.insertAccessToken(db, {
      token: accessToken,
      appId: record.appId,
      appUserId: appUser.appUserId,
      scopes: record.scopes,
      expiresAt,
    });

    void env;

    return {
      accessToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      appId: record.appId,
      appUserId: appUser.appUserId,
      scopes: record.scopes,
    };
  }

  async me(request: Request, db: D1Database): Promise<SdkMeResponse> {
    const token = requireBearerToken(request);
    const record = await sdkAuthRepository.findAccessToken(db, token);
    if (!record) throw new UnauthorizedError('Invalid access token.');

    const nowIso = new Date().toISOString();
    if (record.expiresAt <= nowIso) {
      throw new UnauthorizedError('Access token expired.');
    }

    return {
      appId: record.appId,
      appUserId: record.appUserId,
      scopes: record.scopes,
    };
  }

  // For ops/debugging.
  async debugStats(env: ApiWorkerEnv, db: D1Database): Promise<{ activeTokens: number }> {
    void env;
    const activeTokens = await sdkAuthRepository.countActiveAccessTokens(db);
    return { activeTokens };
  }
}

export const sdkAuthService = new SdkAuthService();
