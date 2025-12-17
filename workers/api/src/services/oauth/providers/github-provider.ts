import type { D1Database } from '@cloudflare/workers-types';
import { BaseOAuthProvider } from './base-provider';
import { authRepository } from '../../../repositories/auth.repository';

/**
 * GitHub OAuth provider implementation.
 */
export class GitHubOAuthProvider extends BaseOAuthProvider {
    readonly name = 'github' as const;
    readonly authorizeUrl = 'https://github.com/login/oauth/authorize';
    readonly tokenUrl = 'https://github.com/login/oauth/access_token';
    readonly userInfoUrl = 'https://api.github.com/user';
    readonly scope = 'read:user user:email';

    getUserIdFromUserInfo = (userInfo: Record<string, unknown>): string | null => {
        if (typeof userInfo.id === 'number') {
            return String(userInfo.id);
        }
        return null;
    };

    getUserEmailFromUserInfo = (userInfo: Record<string, unknown>): string | null => {
        // GitHub user info endpoint typically does not include primary email; we fetch it separately.
        void userInfo;
        return null;
    };

    getUserDisplayNameFromUserInfo = (userInfo: Record<string, unknown>): string | null => {
        return (
            (typeof userInfo.name === 'string' ? userInfo.name : null) ||
            (typeof userInfo.login === 'string' ? userInfo.login : null) ||
            null
        );
    };

    getUserAvatarFromUserInfo = (userInfo: Record<string, unknown>): string | null => {
        return typeof userInfo.avatar_url === 'string' ? userInfo.avatar_url : null;
    };

    findUserByProviderId = async (
        db: D1Database,
        id: string,
    ): Promise<{ id: string; email: string | null } | null> => {
        return authRepository.findUserByGithubId(db, id);
    };

    updateUserWithProvider = async (
        db: D1Database,
        userId: string,
        id: string,
        userInfo: Record<string, unknown>,
    ): Promise<{ id: string; email: string | null }> => {
        return authRepository.updateUser(db, userId, {
            githubId: id,
            displayName:
                typeof userInfo.name === 'string'
                    ? userInfo.name
                    : typeof userInfo.login === 'string'
                        ? userInfo.login
                        : null,
            avatarUrl:
                typeof userInfo.avatar_url === 'string' ? userInfo.avatar_url : null,
        });
    };

    createUserWithProvider = async (
        db: D1Database,
        id: string,
        userInfo: Record<string, unknown>,
        email: string | null,
    ): Promise<{ id: string; email: string | null }> => {
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
                typeof userInfo.avatar_url === 'string' ? userInfo.avatar_url : null,
        });
    };
}
