import type { D1Database } from '@cloudflare/workers-types';
import type { OAuthProvider } from '../../../utils/auth';

/**
 * Configuration for an OAuth provider.
 */
export interface OAuthProviderConfig {
    name: OAuthProvider;
    clientId: string | null;
    clientSecret: string | null;
    authorizeUrl: string;
    tokenUrl: string;
    userInfoUrl: string;
    scope: string;

    // User info extraction methods
    getUserIdFromUserInfo: (userInfo: Record<string, unknown>) => string | null;
    getUserEmailFromUserInfo: (userInfo: Record<string, unknown>) => string | null;
    getUserDisplayNameFromUserInfo: (userInfo: Record<string, unknown>) => string | null;
    getUserAvatarFromUserInfo: (userInfo: Record<string, unknown>) => string | null;

    // Database operations
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

/**
 * Base class for OAuth providers with common functionality.
 */
export abstract class BaseOAuthProvider {
    abstract readonly name: OAuthProvider;
    abstract readonly authorizeUrl: string;
    abstract readonly tokenUrl: string;
    abstract readonly userInfoUrl: string;
    abstract readonly scope: string;

    constructor(
        protected clientId: string | null,
        protected clientSecret: string | null,
    ) { }

    /**
     * Get the provider configuration object.
     */
    getConfig = (): OAuthProviderConfig => {
        return {
            name: this.name,
            clientId: this.clientId,
            clientSecret: this.clientSecret,
            authorizeUrl: this.authorizeUrl,
            tokenUrl: this.tokenUrl,
            userInfoUrl: this.userInfoUrl,
            scope: this.scope,
            getUserIdFromUserInfo: this.getUserIdFromUserInfo,
            getUserEmailFromUserInfo: this.getUserEmailFromUserInfo,
            getUserDisplayNameFromUserInfo: this.getUserDisplayNameFromUserInfo,
            getUserAvatarFromUserInfo: this.getUserAvatarFromUserInfo,
            findUserByProviderId: this.findUserByProviderId,
            updateUserWithProvider: this.updateUserWithProvider,
            createUserWithProvider: this.createUserWithProvider,
        };
    };

    // Abstract arrow functions that must be implemented by subclasses
    abstract getUserIdFromUserInfo: (userInfo: Record<string, unknown>) => string | null;
    abstract getUserEmailFromUserInfo: (userInfo: Record<string, unknown>) => string | null;
    abstract getUserDisplayNameFromUserInfo: (userInfo: Record<string, unknown>) => string | null;
    abstract getUserAvatarFromUserInfo: (userInfo: Record<string, unknown>) => string | null;
    abstract findUserByProviderId: (
        db: D1Database,
        providerId: string,
    ) => Promise<{ id: string; email: string | null } | null>;
    abstract updateUserWithProvider: (
        db: D1Database,
        userId: string,
        providerId: string,
        userInfo: Record<string, unknown>,
    ) => Promise<{ id: string; email: string | null }>;
    abstract createUserWithProvider: (
        db: D1Database,
        providerId: string,
        userInfo: Record<string, unknown>,
        email: string | null,
    ) => Promise<{ id: string; email: string | null }>;
}
