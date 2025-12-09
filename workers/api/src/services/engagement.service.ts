import { engagementRepository } from '../repositories/engagement.repository';

export interface ProjectReactions {
  likesCount: number;
  favoritesCount: number;
  likedByCurrentUser: boolean;
  favoritedByCurrentUser: boolean;
}

class EngagementService {
  async setLike(
    db: D1Database,
    projectId: string,
    userId: string,
    liked: boolean,
  ): Promise<ProjectReactions> {
    if (liked) {
      await engagementRepository.likeProject(db, projectId, userId);
    } else {
      await engagementRepository.unlikeProject(db, projectId, userId);
    }
    const { liked: likedNow, likesCount } =
      await engagementRepository.getLikeStatusAndCount(db, projectId, userId);
    const { favorited, favoritesCount } =
      await engagementRepository.getFavoriteStatusAndCount(
        db,
        projectId,
        userId,
      );
    return {
      likesCount,
      favoritesCount,
      likedByCurrentUser: likedNow,
      favoritedByCurrentUser: favorited,
    };
  }

  async getReactionsForProject(
    db: D1Database,
    projectId: string,
    userId: string,
  ): Promise<ProjectReactions> {
    const { liked, likesCount } =
      await engagementRepository.getLikeStatusAndCount(db, projectId, userId);
    const { favorited, favoritesCount } =
      await engagementRepository.getFavoriteStatusAndCount(
        db,
        projectId,
        userId,
      );
    return {
      likesCount,
      favoritesCount,
      likedByCurrentUser: liked,
      favoritedByCurrentUser: favorited,
    };
  }

  async setFavorite(
    db: D1Database,
    projectId: string,
    userId: string,
    favorited: boolean,
  ): Promise<ProjectReactions> {
    if (favorited) {
      await engagementRepository.favoriteProject(db, projectId, userId);
    } else {
      await engagementRepository.unfavoriteProject(db, projectId, userId);
    }
    // Reuse like status so caller always gets a full snapshot.
    const { liked, likesCount } =
      await engagementRepository.getLikeStatusAndCount(db, projectId, userId);
    const { favoritesCount } =
      await engagementRepository.getFavoriteStatusAndCount(
        db,
        projectId,
        userId,
      );
    return {
      likesCount,
      favoritesCount,
      likedByCurrentUser: liked,
      favoritedByCurrentUser: favorited,
    };
  }

  async getFavoriteProjectIdsForUser(
    db: D1Database,
    userId: string,
  ): Promise<string[]> {
    return engagementRepository.getFavoriteProjectIdsForUser(db, userId);
  }

  async getEngagementCountsForProjects(
    db: D1Database,
    projectIds: string[],
  ): Promise<Record<string, { likesCount: number; favoritesCount: number }>> {
    return engagementRepository.getEngagementCountsForProjects(db, projectIds);
  }
}

export const engagementService = new EngagementService();
