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
import type { OAuthProviderConfig } from './oauth/providers/base-provider';
import { GoogleOAuthProvider } from './oauth/providers/google-provider';
import { GitHubOAuthProvider } from './oauth/providers/github-provider';

class OAuthService {
  private getProviderConfig(
    env: ApiWorkerEnv,
    provider: OAuthProvider,
  ): OAuthProviderConfig {
    if (provider === 'google') {
      const googleProvider = new GoogleOAuthProvider(
        configService.getGoogleClientId(env),
        configService.getGoogleClientSecret(env),
      );
      return googleProvider.getConfig();
    } else {
      const githubProvider = new GitHubOAuthProvider(
        configService.getGithubClientId(env),
        configService.getGithubClientSecret(env),
      );
      return githubProvider.getConfig();
    }
  }

  async handleStart(
    env: ApiWorkerEnv,
    provider: OAuthProvider,
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
      handle: null,
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
      publicUser.handle = fullUser.handle;
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
