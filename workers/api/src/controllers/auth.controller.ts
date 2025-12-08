import type { ApiWorkerEnv } from '../types/env';
import {
  jsonResponse,
  emptyResponse,
  readJson,
  withSetCookie,
} from '../utils/http';
import {
  buildSessionCookie,
  clearSessionCookie,
  getSessionIdFromRequest,
  hashPassword,
  toPublicUser,
  verifyPassword,
} from '../utils/auth';
import { oauthService } from '../services/oauth.service';
import { ValidationError, UnauthorizedError } from '../utils/error-handler';
import { validateEmailPassword } from '../utils/validation';
import { authRepository } from '../repositories/auth.repository';
import type { PublicUser } from '../types/user';

class AuthController {
  // GET /api/v1/me
  async handleMe(request: Request, db: D1Database): Promise<Response> {
    const sessionId = getSessionIdFromRequest(request);
    if (!sessionId) {
      return jsonResponse({ user: null });
    }
    const result = await authRepository.getSessionWithUser(db, sessionId);
    if (!result) {
      return jsonResponse({ user: null });
    }
    const publicUser: PublicUser = toPublicUser(result.user);
    return jsonResponse({ user: publicUser });
  }

  // POST /api/v1/logout
  async handleLogout(request: Request, db: D1Database): Promise<Response> {
    const sessionId = getSessionIdFromRequest(request);
    if (sessionId) {
      await authRepository.deleteSession(db, sessionId);
    }
    const response = emptyResponse(204);
    return withSetCookie(response, clearSessionCookie());
  }

  // POST /api/v1/auth/email/signup
  async handleEmailSignup(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
  ): Promise<Response> {
    const body = await readJson(request);
    const { email, password } = validateEmailPassword(body);

    const existing = await authRepository.findUserByEmail(db, email);
    if (existing && existing.passwordHash) {
      throw new ValidationError('Email is already registered.');
    }

    const passwordHash = await hashPassword(password, env);
    const userId = existing?.id ?? crypto.randomUUID();

    const user = existing
      ? await authRepository.updateUser(db, userId, {
          email,
          passwordHash,
        })
      : await authRepository.createUser(db, {
          id: userId,
          email,
          passwordHash,
        });

    const session = await authRepository.createSession(db, user.id);
    const publicUser = toPublicUser(user);
    const response = jsonResponse({ user: publicUser });
    return withSetCookie(response, buildSessionCookie(session.id));
  }

  // POST /api/v1/auth/email/login
  async handleEmailLogin(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
  ): Promise<Response> {
    const body = await readJson(request);
    const { email, password } = validateEmailPassword(body);

    const user = await authRepository.findUserByEmail(db, email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    const ok = await verifyPassword(password, user.passwordHash, env);
    if (!ok) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    const session = await authRepository.createSession(db, user.id);
    const publicUser = toPublicUser(user);
    const response = jsonResponse({ user: publicUser });
    return withSetCookie(response, buildSessionCookie(session.id));
  }

  // GET /api/v1/auth/google/start
  async handleGoogleStart(
    request: Request,
    env: ApiWorkerEnv,
    url: URL,
  ): Promise<Response> {
    return oauthService.handleStart(env, 'google', request, url);
  }

  // GET /api/v1/auth/google/callback
  async handleGoogleCallback(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    url: URL,
  ): Promise<Response> {
    return oauthService.handleCallback(env, db, 'google', request, url);
  }

  // GET /api/v1/auth/github/start
  async handleGithubStart(
    request: Request,
    env: ApiWorkerEnv,
    url: URL,
  ): Promise<Response> {
    return oauthService.handleStart(env, 'github', request, url);
  }

  // GET /api/v1/auth/github/callback
  async handleGithubCallback(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    url: URL,
  ): Promise<Response> {
    return oauthService.handleCallback(env, db, 'github', request, url);
  }
}

export const authController = new AuthController();
