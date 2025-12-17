import type { D1Database } from '@cloudflare/workers-types';
import { BaseOAuthProvider } from './base-provider';
import { authRepository } from '../../../repositories/auth.repository';

/**
 * Google OAuth provider implementation.
 */
export class GoogleOAuthProvider extends BaseOAuthProvider {
    readonly name = 'google' as const;
    readonly authorizeUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
    readonly tokenUrl = 'https://oauth2.googleapis.com/token';
    readonly userInfoUrl = 'https://openidconnect.googleapis.com/v1/userinfo';
    readonly scope = 'openid email profile';

    getUserIdFromUserInfo = (userInfo: Record<string, unknown>): string | null => {
        return typeof userInfo.sub === 'string' ? userInfo.sub : null;
    };

    getUserEmailFromUserInfo = (userInfo: Record<string, unknown>): string | null => {
        if (typeof userInfo.email === 'string' && userInfo.email.trim()) {
            return userInfo.email.trim().toLowerCase();
        }
        return null;
    };

    getUserDisplayNameFromUserInfo = (userInfo: Record<string, unknown>): string | null => {
        return typeof userInfo.name === 'string' ? userInfo.name : null;
    };

    getUserAvatarFromUserInfo = (userInfo: Record<string, unknown>): string | null => {
        return typeof userInfo.picture === 'string' ? userInfo.picture : null;
    };

    findUserByProviderId = async (
        db: D1Database,
        sub: string,
    ): Promise<{ id: string; email: string | null } | null> => {
        return authRepository.findUserByGoogleSub(db, sub);
    };

    updateUserWithProvider = async (
        db: D1Database,
        userId: string,
        sub: string,
        userInfo: Record<string, unknown>,
    ): Promise<{ id: string; email: string | null }> => {
        return authRepository.updateUser(db, userId, {
            googleSub: sub,
            displayName: typeof userInfo.name === 'string' ? userInfo.name : null,
            avatarUrl: typeof userInfo.picture === 'string' ? userInfo.picture : null,
        });
    };

    createUserWithProvider = async (
        db: D1Database,
        sub: string,
        userInfo: Record<string, unknown>,
        email: string | null,
    ): Promise<{ id: string; email: string | null }> => {
        return authRepository.createUser(db, {
            id: crypto.randomUUID(),
            email,
            googleSub: sub,
            displayName: typeof userInfo.name === 'string' ? userInfo.name : null,
            avatarUrl: typeof userInfo.picture === 'string' ? userInfo.picture : null,
        });
    };
}
