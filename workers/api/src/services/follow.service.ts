import { authRepository } from '../repositories/auth.repository';
import { followRepository } from '../repositories/follow.repository';
import { NotFoundError, ValidationError } from '../utils/error-handler';

export interface FollowSummary {
  followersCount: number;
  isFollowing: boolean;
}

class FollowService {
  private resolveTargetUser = async (
    db: D1Database,
    identifier: string,
  ): Promise<{ id: string } | null> => {
    const trimmed = identifier?.trim();
    if (!trimmed) return null;

    const byHandle = await authRepository.findUserByHandle(db, trimmed);
    if (byHandle) return { id: byHandle.id };

    const byId = await authRepository.findUserById(db, trimmed);
    if (byId) return { id: byId.id };

    return null;
  };

  getFollowSummary = async (
    db: D1Database,
    identifier: string,
    viewerUserId?: string | null,
  ): Promise<FollowSummary> => {
    const target = await this.resolveTargetUser(db, identifier);
    if (!target) {
      throw new NotFoundError('User not found');
    }

    const followersCount = await followRepository.countFollowers(db, target.id);

    if (!viewerUserId) {
      return { followersCount, isFollowing: false };
    }

    const isFollowing = await followRepository.isFollowing(
      db,
      viewerUserId,
      target.id,
    );
    return { followersCount, isFollowing };
  };

  follow = async (
    db: D1Database,
    viewerUserId: string,
    identifier: string,
  ): Promise<FollowSummary> => {
    const target = await this.resolveTargetUser(db, identifier);
    if (!target) {
      throw new NotFoundError('User not found');
    }
    if (viewerUserId === target.id) {
      throw new ValidationError('Cannot follow yourself.');
    }

    await followRepository.follow(db, viewerUserId, target.id, new Date().toISOString());
    return this.getFollowSummary(db, identifier, viewerUserId);
  };

  unfollow = async (
    db: D1Database,
    viewerUserId: string,
    identifier: string,
  ): Promise<FollowSummary> => {
    const target = await this.resolveTargetUser(db, identifier);
    if (!target) {
      throw new NotFoundError('User not found');
    }
    if (viewerUserId === target.id) {
      throw new ValidationError('Cannot unfollow yourself.');
    }

    await followRepository.unfollow(db, viewerUserId, target.id);
    return this.getFollowSummary(db, identifier, viewerUserId);
  };
}

export const followService = new FollowService();

