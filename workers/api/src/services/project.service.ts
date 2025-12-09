import type { ApiWorkerEnv } from '../types/env';
import {
  SourceType,
  type Project,
  type ProjectMetadataOverrides,
} from '../types/project';
import { slugify } from '../utils/strings';
import { projectRepository } from '../repositories/project.repository';
import { metadataService } from './metadata.service';
import { configService } from './config.service';
import { engagementService } from './engagement.service';

interface CreateProjectInput {
  name: string;
  identifier: string;
  sourceType?: SourceType;
  htmlContent?: string;
  metadata?: ProjectMetadataOverrides;
  ownerId?: string;
  isPublic?: boolean;
}

class ProjectService {
  async getProjects(db: D1Database): Promise<Project[]> {
    return projectRepository.getAllProjects(db);
  }

  async getProjectsForUser(
    db: D1Database,
    ownerId: string,
  ): Promise<Project[]> {
    // Simple filter by owner on top of repository – keeps repository focused on persistence.
    const all = await projectRepository.getAllProjects(db);
    return all.filter((p) => p.ownerId === ownerId);
  }

  async createProject(
    env: ApiWorkerEnv,
    db: D1Database,
    input: CreateProjectInput,
  ): Promise<Project> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const normalizedSourceType = input.sourceType ?? SourceType.GitHub;
    const slugSeed = slugify(input.name);

    const metadata = await metadataService.ensureProjectMetadata(env, {
      seedName: input.name,
      identifier: input.identifier,
      sourceType: normalizedSourceType,
      htmlContent: input.htmlContent,
      slugSeed,
      overrides: input.metadata,
    });

    const deployTarget = configService.getDeployTarget(env);
    const url = this.buildProjectUrl(env, metadata.slug, deployTarget);

    return projectRepository.createProjectRecord(db, {
      id,
      ownerId: input.ownerId,
      isPublic: input.isPublic ?? true,
      name: metadata.name,
      repoUrl: input.identifier,
      sourceType: normalizedSourceType,
      slug: metadata.slug,
      lastDeployed: now,
      status: 'Live',
      url,
      description: metadata.description,
      framework: 'Unknown',
      category: metadata.category,
      tags: metadata.tags,
      deployTarget,
      htmlContent: input.htmlContent,
    });
  }

  async updateProject(
    db: D1Database,
    id: string,
    patch: {
      name?: string;
      repoUrl?: string;
      description?: string;
      category?: string;
      tags?: string[];
      isPublic?: boolean;
    },
  ): Promise<Project | null> {
    return projectRepository.updateProjectRecord(db, id, patch);
  }

  async getProjectById(db: D1Database, id: string): Promise<Project | null> {
    return projectRepository.getProjectById(db, id);
  }

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

    const engagement: Record<
      string,
      { likesCount: number; favoritesCount: number }
    > = {};
    items.forEach((project) => {
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
      items,
      page,
      pageSize,
      total,
      engagement,
    };
  }

  private buildProjectUrl(
    env: ApiWorkerEnv,
    slug: string,
    target: Project['deployTarget'],
  ): string | undefined {
    if (target === 'local') {
      return `/apps/${encodeURIComponent(slug)}/`;
    }
    if (target === 'r2') {
      const domain = configService.getAppsRootDomain(env);
      if (domain) {
        return `https://${slug}.${domain}/`;
      }
    }
    return undefined;
  }
}

export const projectService = new ProjectService();
