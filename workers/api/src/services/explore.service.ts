import type { D1Database } from '@cloudflare/workers-types';
import type { Project } from '../types/project';
import { projectRepository } from '../repositories/project.repository';
import { publicAuthorService } from './public-author.service';

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
            languages?: string[];
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
        availableLanguages: string[];
        engagement: Record<string, { likesCount: number; favoritesCount: number }>;
    }> {
        const page = Math.max(1, options.page ?? 1);
        const pageSize = Math.max(1, Math.min(50, options.pageSize ?? 12));

        const fromDateInclusive = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
        const result = await projectRepository.queryExplorePage(db, {
            languages: options.languages,
            search: options.search,
            category: options.category,
            tag: options.tag,
            isExtensionSupported: options.isExtensionSupported,
            sort: options.sort ?? 'recent',
            limit: pageSize,
            offset: (page - 1) * pageSize,
            fromDateInclusive,
        });
        const items = await publicAuthorService.enrichProjects(db, result.items);

        return {
            items,
            page,
            pageSize,
            total: result.total,
            availableLanguages: result.availableLanguages,
            engagement: result.engagement,
        };
    }
}

export const exploreService = new ExploreService();
