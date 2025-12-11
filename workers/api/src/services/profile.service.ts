import { profileRepository } from '../repositories/profile.repository';
import { projectRepository } from '../repositories/project.repository';
import { engagementService } from './engagement.service';
import { authRepository } from '../repositories/auth.repository';
import { toPublicUser } from '../utils/auth';
import type { PublicUser } from '../types/user';
import type { Project } from '../types/project';
import type { ProfileLinkRecord } from '../repositories/profile.repository';

export interface UserProfile {
  bio: string | null;
  links: ProfileLinkRecord[];
  pinnedProjectIds: string[];
}

export interface PublicUserProfile {
  user: PublicUser;
  profile: UserProfile;
  stats: {
    publicProjectsCount: number;
    totalLikes: number;
    totalFavorites: number;
  };
  projects: Array<Project & { likesCount?: number; favoritesCount?: number }>;
}

class ProfileService {
  async getOrCreateProfile(
    db: D1Database,
    userId: string,
  ): Promise<UserProfile> {
    const existing = await profileRepository.getProfile(db, userId);
    if (existing) return existing;
    // Return an in-memory default instead of writing during GET to avoid
    // mutating profiles on read.
    return {
      bio: null,
      links: [],
      pinnedProjectIds: [],
    };
  }

  async updateProfile(
    db: D1Database,
    userId: string,
    patch: Partial<UserProfile>,
  ): Promise<UserProfile> {
    const sanitized: Partial<UserProfile> = {};

    if (patch.bio !== undefined) {
      sanitized.bio =
        patch.bio && patch.bio.trim().length > 0
          ? patch.bio.trim().slice(0, 500)
          : null;
    }

    if (patch.links !== undefined) {
      const links: ProfileLinkRecord[] = [];
      patch.links.forEach((link) => {
        if (!link || typeof link.url !== 'string') return;
        const url = link.url.trim();
        if (!url) return;
        const label =
          typeof link.label === 'string' && link.label.trim().length > 0
            ? link.label.trim().slice(0, 50)
            : null;
        links.push({ label, url: url.slice(0, 300) });
      });
      // Cap to a small number to avoid unbounded payloads.
      sanitized.links = links.slice(0, 12);
    }

    if (patch.pinnedProjectIds !== undefined) {
      // Keep only unique string IDs and cap to a small number to avoid
      // unbounded payloads.
      const unique = Array.from(
        new Set(
          patch.pinnedProjectIds
            .filter((id): id is string => typeof id === 'string')
            .map((id) => id),
        ),
      );
      sanitized.pinnedProjectIds = unique.slice(0, 12);
    }

    return profileRepository.upsertProfile(db, userId, sanitized);
  }

  /**
   * Public-facing profile used for community pages. Includes basic user
   * identity, profile fields and a list of their public projects with
   * aggregated engagement stats.
   */
  async getPublicProfileByIdentifier(
    db: D1Database,
    identifier: string,
  ): Promise<PublicUserProfile | null> {
    let user = await authRepository.findUserByHandle(db, identifier);
    if (!user) {
      // Fallback to lookup by internal id so older /u/:id links keep working.
      user = await authRepository.findUserById(db, identifier);
    }
    if (!user) {
      return null;
    }

    const publicUser: PublicUser = toPublicUser(user);

    // Load profile (returns an in-memory default if none exists; no writes on GET).
    const profile = await this.getOrCreateProfile(db, user.id);

    // Fetch this user's public projects.
    const projects = await projectRepository.queryProjects(db, {
      ownerId: user.id,
      onlyPublic: true,
    });

    // Reorder projects so that pinned apps appear first, in the exact order
    // specified by pinnedProjectIds. The remaining projects keep their
    // original ordering (most recently deployed first).
    const pinnedIds = profile.pinnedProjectIds ?? [];
    const pinnedSet = new Set(pinnedIds);

    const pinnedProjects: Project[] = [];
    pinnedIds.forEach((id) => {
      const found = projects.find((p) => p.id === id);
      if (found) {
        pinnedProjects.push(found);
      }
    });

    const otherProjects = projects.filter((p) => !pinnedSet.has(p.id));
    const orderedProjects: Project[] = [...pinnedProjects, ...otherProjects];

    const projectIds = orderedProjects.map((p) => p.id);
    const engagement = await engagementService.getEngagementCountsForProjects(
      db,
      projectIds,
    );

    const projectsWithStats = orderedProjects.map((project) => {
      const counts = engagement[project.id] ?? {
        likesCount: 0,
        favoritesCount: 0,
      };
      return {
        ...project,
        likesCount: counts.likesCount,
        favoritesCount: counts.favoritesCount,
      };
    });

    const stats = projectsWithStats.reduce(
      (acc, project) => {
        const likes = (project as { likesCount?: number }).likesCount ?? 0;
        const favorites =
          (project as { favoritesCount?: number }).favoritesCount ?? 0;
        acc.publicProjectsCount += 1;
        acc.totalLikes += likes;
        acc.totalFavorites += favorites;
        return acc;
      },
      {
        publicProjectsCount: 0,
        totalLikes: 0,
        totalFavorites: 0,
      },
    );

    return {
      user: publicUser,
      profile,
      stats,
      projects: projectsWithStats,
    };
  }
}

export const profileService = new ProfileService();
