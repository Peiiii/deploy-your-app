import type { D1Database } from '@cloudflare/workers-types';
import type { Project } from '../types/project';
import { projectRepository } from '../repositories/project.repository';
import { engagementService } from './engagement.service';
import { authRepository } from '../repositories/auth.repository';

/**
 * Service for handling public explore/discovery features.
 */
export class ExploreService {
    /**
     * Public explore feed: returns a paginated list of projects visible on
     * marketing / explore surfaces, with backend-side filtering / sorting.
     */
    async getExploreProjects(
        db: D1Database,
        options: {
            search?: string;
            category?: string;
            tag?: string;
            isExtensionSupported?: boolean;
            sort?: 'recent' | 'popularity';
            page?: number;
            pageSize?: number;
        },
    ): Promise<{
        items: Project[];
        page: number;
        pageSize: number;
        total: number;
        engagement: Record<string, { likesCount: number; favoritesCount: number }>;
    }> {
        const page = Math.max(1, options.page ?? 1);
        const pageSize = Math.max(1, Math.min(50, options.pageSize ?? 12));

        const allPublic = await projectRepository.queryProjects(db, {
            search: options.search,
            category: options.category,
            tag: options.tag,
            onlyPublic: true,
            ...(typeof options.isExtensionSupported === 'boolean'
                ? { isExtensionSupported: options.isExtensionSupported }
                : {}),
        });

        const idList = allPublic.map((p) => p.id);
        const counts = await engagementService.getEngagementCountsForProjects(
            db,
            idList,
        );

        let sorted: Project[];
        if (options.sort === 'popularity') {
            sorted = [...allPublic].sort((a, b) => {
                const aCounts = counts[a.id] ?? {
                    likesCount: 0,
                    favoritesCount: 0,
                };
                const bCounts = counts[b.id] ?? {
                    likesCount: 0,
                    favoritesCount: 0,
                };
                const aScore = aCounts.likesCount + aCounts.favoritesCount * 1.5;
                const bScore = bCounts.likesCount + bCounts.favoritesCount * 1.5;
                if (bScore !== aScore) {
                    return bScore - aScore;
                }
                if (bCounts.likesCount !== aCounts.likesCount) {
                    return bCounts.likesCount - aCounts.likesCount;
                }
                return (
                    new Date(b.lastDeployed).getTime() -
                    new Date(a.lastDeployed).getTime()
                );
            });
        } else {
            // Default sort: most recently deployed first.
            sorted = [...allPublic].sort(
                (a, b) =>
                    new Date(b.lastDeployed).getTime() -
                    new Date(a.lastDeployed).getTime(),
            );
        }

        const total = sorted.length;
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const items = sorted.slice(start, end);

        // Load owner handles/display names in bulk so the frontend doesn't have to
        // call profile APIs to build author badges on explore cards.
        const ownerIds = Array.from(
            new Set(
                items
                    .map((p) => p.ownerId)
                    .filter((id): id is string => typeof id === 'string' && id.length > 0),
            ),
        );
        const owners = await authRepository.findUsersByIds(db, ownerIds);
        const ownersById = owners.reduce(
            (acc, user) => {
                acc[user.id] = {
                    handle: user.handle ?? null,
                    displayName: user.displayName ?? null,
                };
                return acc;
            },
            {} as Record<string, { handle: string | null; displayName: string | null }>,
        );
        const enrichedItems = items.map((project) => ({
            ...project,
            ownerHandle:
                project.ownerId && ownersById[project.ownerId]
                    ? ownersById[project.ownerId].handle
                    : null,
            ownerDisplayName:
                project.ownerId && ownersById[project.ownerId]
                    ? ownersById[project.ownerId].displayName
                    : null,
        }));

        const engagement: Record<
            string,
            { likesCount: number; favoritesCount: number }
        > = {};
        enrichedItems.forEach((project) => {
            const entry = counts[project.id] ?? {
                likesCount: 0,
                favoritesCount: 0,
            };
            engagement[project.id] = {
                likesCount: entry.likesCount,
                favoritesCount: entry.favoritesCount,
            };
        });

        return {
            items: enrichedItems,
            page,
            pageSize,
            total,
            engagement,
        };
    }
}

export const exploreService = new ExploreService();
