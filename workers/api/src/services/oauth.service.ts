import type { ApiWorkerEnv } from '../types/env';
import { configService } from './config.service';
import { ConfigurationError, UnauthorizedError } from '../utils/error-handler';
import {
  buildOAuthStateCookie,
  clearOAuthStateCookie,
  readOAuthStateCookie,
  buildSessionCookie,
  type OAuthProvider,
} from '../utils/auth';
import { authRepository } from '../repositories/auth.repository';
import { jsonResponse, emptyResponse } from '../utils/http';
import type { PublicUser } from '../types/user';

export interface OAuthProviderConfig {
  name: OAuthProvider;
  clientId: string | null;
  clientSecret: string | null;
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string;
  getUserIdFromUserInfo: (userInfo: Record<string, unknown>) => string | null;
  getUserEmailFromUserInfo: (
    userInfo: Record<string, unknown>,
  ) => string | null;
  getUserDisplayNameFromUserInfo: (
    userInfo: Record<string, unknown>,
  ) => string | null;
  getUserAvatarFromUserInfo: (
    userInfo: Record<string, unknown>,
  ) => string | null;
  findUserByProviderId: (
    db: D1Database,
    providerId: string,
  ) => Promise<{ id: string; email: string | null } | null>;
  updateUserWithProvider: (
    db: D1Database,
    userId: string,
    providerId: string,
    userInfo: Record<string, unknown>,
  ) => Promise<{ id: string; email: string | null }>;
  createUserWithProvider: (
    db: D1Database,
    providerId: string,
    userInfo: Record<string, unknown>,
    email: string | null,
  ) => Promise<{ id: string; email: string | null }>;
}

class OAuthService {
  private getProviderConfig(
    env: ApiWorkerEnv,
    provider: OAuthProvider,
  ): OAuthProviderConfig {
    if (provider === 'google') {
      return {
        name: 'google',
        clientId: configService.getGoogleClientId(env),
        clientSecret: configService.getGoogleClientSecret(env),
        authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
        scope: 'openid email profile',
        getUserIdFromUserInfo: (userInfo) => {
          return typeof userInfo.sub === 'string' ? userInfo.sub : null;
        },
        getUserEmailFromUserInfo: (userInfo) => {
          if (typeof userInfo.email === 'string' && userInfo.email.trim()) {
            return userInfo.email.trim().toLowerCase();
          }
          return null;
        },
        getUserDisplayNameFromUserInfo: (userInfo) => {
          return typeof userInfo.name === 'string' ? userInfo.name : null;
        },
        getUserAvatarFromUserInfo: (userInfo) => {
          return typeof userInfo.picture === 'string' ? userInfo.picture : null;
        },
        findUserByProviderId: async (db, sub) => {
          return authRepository.findUserByGoogleSub(db, sub);
        },
        updateUserWithProvider: async (db, userId, sub, userInfo) => {
          return authRepository.updateUser(db, userId, {
            googleSub: sub,
            displayName:
              typeof userInfo.name === 'string' ? userInfo.name : null,
            avatarUrl:
              typeof userInfo.picture === 'string' ? userInfo.picture : null,
          });
        },
        createUserWithProvider: async (db, sub, userInfo, email) => {
          return authRepository.createUser(db, {
            id: crypto.randomUUID(),
            email,
            googleSub: sub,
            displayName:
              typeof userInfo.name === 'string' ? userInfo.name : null,
            avatarUrl:
              typeof userInfo.picture === 'string' ? userInfo.picture : null,
          });
        },
      };
    } else {
      return {
        name: 'github',
        clientId: configService.getGithubClientId(env),
        clientSecret: configService.getGithubClientSecret(env),
        authorizeUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        userInfoUrl: 'https://api.github.com/user',
        scope: 'read:user user:email',
        getUserIdFromUserInfo: (userInfo) => {
          if (typeof userInfo.id === 'number') {
            return String(userInfo.id);
          }
          return null;
        },
        getUserEmailFromUserInfo: (userInfo) => {
          // GitHub user info endpoint typically does not include primary email; we fetch it separately.
          void userInfo;
          return null;
        },
        getUserDisplayNameFromUserInfo: (userInfo) => {
          return (
            (typeof userInfo.name === 'string' ? userInfo.name : null) ||
            (typeof userInfo.login === 'string' ? userInfo.login : null) ||
            null
          );
        },
        getUserAvatarFromUserInfo: (userInfo) => {
          return typeof userInfo.avatar_url === 'string'
            ? userInfo.avatar_url
            : null;
        },
        findUserByProviderId: async (db, id) => {
          return authRepository.findUserByGithubId(db, id);
        },
        updateUserWithProvider: async (db, userId, id, userInfo) => {
          return authRepository.updateUser(db, userId, {
            githubId: id,
            displayName:
              typeof userInfo.name === 'string'
                ? userInfo.name
                : typeof userInfo.login === 'string'
                  ? userInfo.login
                  : null,
            avatarUrl:
              typeof userInfo.avatar_url === 'string'
                ? userInfo.avatar_url
                : null,
          });
        },
        createUserWithProvider: async (db, id, userInfo, email) => {
          return authRepository.createUser(db, {
            id: crypto.randomUUID(),
            email,
            githubId: id,
            displayName:
              typeof userInfo.name === 'string'
                ? userInfo.name
                : typeof userInfo.login === 'string'
                  ? userInfo.login
                  : null,
            avatarUrl:
              typeof userInfo.avatar_url === 'string'
                ? userInfo.avatar_url
                : null,
          });
        },
      };
    }
  }

  async handleStart(
    env: ApiWorkerEnv,
    provider: OAuthProvider,
    request: Request,
    url: URL,
  ): Promise<Response> {
    const providerConfig = this.getProviderConfig(env, provider);
    const clientId = providerConfig.clientId;

    if (!clientId) {
      throw new ConfigurationError(
        `${provider.toUpperCase()}_CLIENT_ID is not configured.`,
      );
    }

    const redirectBase = configService.getAuthRedirectBase(env);
    const redirectUrl = new URL(
      `/api/v1/auth/${provider}/callback`,
      redirectBase,
    );
    const state = crypto.randomUUID();
    const originalRedirect =
      url.searchParams.get('redirect') || redirectBase;

    const authUrl = new URL(providerConfig.authorizeUrl);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUrl.toString());
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('scope', providerConfig.scope);

    if (provider === 'google') {
      authUrl.searchParams.set('response_type', 'code');
    }

    const response = emptyResponse(302);
    const headers = new Headers(response.headers);
    headers.set('Location', authUrl.toString());
    headers.append(
      'Set-Cookie',
      buildOAuthStateCookie(provider, state, originalRedirect),
    );
    return new Response(null, {
      status: 302,
      headers,
    });
  }

  async handleCallback(
    env: ApiWorkerEnv,
    db: D1Database,
    provider: OAuthProvider,
    request: Request,
    url: URL,
  ): Promise<Response> {
    const providerConfig = this.getProviderConfig(env, provider);
    const clientId = providerConfig.clientId;
    const clientSecret = providerConfig.clientSecret;

    if (!clientId || !clientSecret) {
      throw new ConfigurationError(
        `${provider.toUpperCase()} OAuth is not configured.`,
      );
    }

    const code = url.searchParams.get('code');
    const returnedState = url.searchParams.get('state');
    if (!code || !returnedState) {
      throw new UnauthorizedError(
        `Missing code or state from ${provider.toUpperCase()} OAuth.`,
      );
    }

    const stateCookie = readOAuthStateCookie(request, provider);
    if (!stateCookie || stateCookie.state !== returnedState) {
      throw new UnauthorizedError('Invalid or expired OAuth state.');
    }

    const redirectBase = configService.getAuthRedirectBase(env);
    const redirectUrl = new URL(
      `/api/v1/auth/${provider}/callback`,
      redirectBase,
    );

    const accessToken = await this.exchangeCodeForToken(
      providerConfig,
      code,
      redirectUrl.toString(),
      clientId,
      clientSecret,
    );

    const userInfo = await this.fetchUserInfo(
      providerConfig,
      accessToken,
      provider === 'github',
    );

    const providerId = providerConfig.getUserIdFromUserInfo(userInfo);
    if (!providerId) {
      throw new UnauthorizedError(
        `Invalid ${provider.toUpperCase()} user info.`,
      );
    }

    const emailFromProvider = providerConfig.getUserEmailFromUserInfo(userInfo);
    let email = emailFromProvider;

    if (provider === 'github' && !email) {
      email = await this.fetchGithubEmail(accessToken);
    }

    let user = await providerConfig.findUserByProviderId(db, providerId);

    if (!user && email) {
      const byEmail = await authRepository.findUserByEmail(db, email);
      if (byEmail) {
        user = await providerConfig.updateUserWithProvider(
          db,
          byEmail.id,
          providerId,
          userInfo,
        );
      }
    }

    if (!user) {
      user = await providerConfig.createUserWithProvider(
        db,
        providerId,
        userInfo,
        email,
      );
    }

    const session = await authRepository.createSession(db, user.id);
    const publicUser: PublicUser = {
      id: user.id,
      email: user.email,
      displayName: null,
      avatarUrl: null,
      providers: {
        email: false,
        google: provider === 'google',
        github: provider === 'github',
      },
    };

    const fullUser = await authRepository.findUserById(db, user.id);
    if (fullUser) {
      publicUser.displayName = fullUser.displayName;
      publicUser.avatarUrl = fullUser.avatarUrl;
      if (fullUser.passwordHash) {
        publicUser.providers.email = true;
      }
    }

    const redirectTarget = stateCookie.redirectTo || redirectBase;
    const response = jsonResponse({
      user: publicUser,
      redirectTo: redirectTarget,
    });

    const headers = new Headers(response.headers);
    headers.append('Set-Cookie', buildSessionCookie(session.id));
    headers.append('Set-Cookie', clearOAuthStateCookie(provider));
    headers.set('Location', redirectTarget);
    return new Response(null, {
      status: 302,
      headers,
    });
  }

  private async exchangeCodeForToken(
    config: OAuthProviderConfig,
    code: string,
    redirectUri: string,
    clientId: string,
    clientSecret: string,
  ): Promise<string> {
    const body =
      config.name === 'google'
        ? new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri,
          })
        : JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            redirect_uri: redirectUri,
          });

    const headers: Record<string, string> =
      config.name === 'google'
        ? { 'Content-Type': 'application/x-www-form-urlencoded' }
        : {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          };

    const tokenResp = await fetch(config.tokenUrl, {
      method: 'POST',
      headers,
      body: body as string | URLSearchParams,
    });

    if (!tokenResp.ok) {
      const text = await tokenResp.text().catch(() => '');
      console.error(
        `${config.name} token exchange failed:`,
        tokenResp.status,
        tokenResp.statusText,
        text,
      );
      throw new UnauthorizedError(
        `Failed to complete ${config.name} login.`,
      );
    }

    const tokenJson = (await tokenResp.json()) as {
      access_token?: string;
    };
    const accessToken = tokenJson.access_token;
    if (!accessToken) {
      throw new UnauthorizedError(
        `Missing access token from ${config.name}.`,
      );
    }

    return accessToken;
  }

  private async fetchUserInfo(
    config: OAuthProviderConfig,
    accessToken: string,
    isGithub: boolean,
  ): Promise<Record<string, unknown>> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    };
    if (isGithub) {
      headers['User-Agent'] = 'gemigo-api-worker';
    }

    const userInfoResp = await fetch(config.userInfoUrl, {
      headers,
    });

    if (!userInfoResp.ok) {
      const text = await userInfoResp.text().catch(() => '');
      console.error(
        `${config.name} userinfo failed:`,
        userInfoResp.status,
        userInfoResp.statusText,
        text,
      );
      throw new UnauthorizedError(
        `Failed to fetch ${config.name} user info.`,
      );
    }

    return (await userInfoResp.json()) as Record<string, unknown>;
  }

  private async fetchGithubEmail(accessToken: string): Promise<string | null> {
    try {
      const emailResp = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'gemigo-api-worker',
        },
      });
      if (emailResp.ok) {
        const emails = (await emailResp.json()) as Array<{
          email?: string;
          primary?: boolean;
          verified?: boolean;
        }>;
        const primary =
          emails.find((e) => e.primary && e.verified) ??
          emails.find((e) => e.verified) ??
          emails[0];
        if (primary?.email) {
          return primary.email.trim().toLowerCase();
        }
      }
    } catch {
      // Ignore email fetch errors – GitHub may hide emails.
    }
    return null;
  }
}

export const oauthService = new OAuthService();
