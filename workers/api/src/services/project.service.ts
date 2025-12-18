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
import { analyticsService } from './analytics.service';
import { ValidationError } from '../utils/error-handler';

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
  async getProjects(
    db: D1Database,
    options?: { page?: number; pageSize?: number },
  ): Promise<{ items: Project[]; page: number; pageSize: number; total: number }> {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 50;

    const { items, total } = await projectRepository.getAllProjects(db, { page, pageSize });

    return {
      items,
      page,
      pageSize,
      total,
    };
  }

  async getProjectsForAdmin(
    db: D1Database,
    options?: {
      page?: number;
      pageSize?: number;
      search?: string;
      includeDeleted?: boolean;
    },
  ): Promise<{ items: Project[]; page: number; pageSize: number; total: number }> {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 50;

    const result = await projectRepository.queryProjectsWithCount(db, {
      page,
      pageSize,
      search: options?.search?.trim() || undefined,
      includeDeleted: options?.includeDeleted ?? true,
    });

    return {
      items: result.items,
      page,
      pageSize,
      total: result.total,
    };
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

    // Ensure slug is globally unique across all projects (including deleted),
    // so that URLs and analytics remain stable over time.
    const uniqueSlug = await this.ensureUniqueSlug(db, metadata.slug);

    const deployTarget = configService.getDeployTarget(env);
    const url =
      // Do not pre-allocate a potentially public URL before the first successful
      // deployment. The deployment pipeline will set the live URL once ready.
      undefined;

    return projectRepository.createProjectRecord(db, {
      id,
      ownerId: input.ownerId,
      // Early-stage growth: default new projects to public so they can show up
      // in Explore without extra steps. Owners can still toggle visibility later.
      isPublic: input.isPublic ?? true,
      name: metadata.name,
      repoUrl: input.identifier,
      sourceType: normalizedSourceType,
      slug: uniqueSlug,
      // Project creation does not imply a successful deployment. We keep a valid
      // timestamp (used for sorting) but mark the project as Offline until a
      // deployment run reports success.
      lastDeployed: now,
      status: 'Offline',
      url,
      description: metadata.description,
      framework: 'Unknown',
      category: metadata.category,
      tags: metadata.tags,
      deployTarget,
      htmlContent: input.htmlContent,
    });
  }

  async createDraftProject(
    env: ApiWorkerEnv,
    db: D1Database,
    input?: { name?: string; ownerId?: string; isPublic?: boolean },
  ): Promise<Project> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const seedName =
      input?.name && input.name.trim().length > 0
        ? input.name.trim()
        : `new-app-${id.slice(0, 6)}`;

    const deployTarget = configService.getDeployTarget(env);

    return projectRepository.createProjectRecord(db, {
      id,
      ownerId: input?.ownerId,
      isPublic: input?.isPublic ?? true,
      name: seedName,
      repoUrl: `draft:${id}`,
      sourceType: undefined,
      slug: undefined,
      lastDeployed: now,
      status: 'Offline',
      url: undefined,
      description: undefined,
      framework: 'Unknown',
      category: undefined,
      tags: undefined,
      deployTarget,
      htmlContent: undefined,
    });
  }

  async ensureSlugForProject(
    env: ApiWorkerEnv,
    db: D1Database,
    project: Project,
  ): Promise<Project> {
    if (project.slug && project.slug.trim().length > 0) {
      return project;
    }

    const baseSlug = slugify(project.name || project.id);
    const metadata = await metadataService.ensureProjectMetadata(env, {
      seedName: project.name,
      identifier: project.repoUrl,
      sourceType: project.sourceType ?? SourceType.GitHub,
      htmlContent: project.htmlContent,
      slugSeed: baseSlug,
      overrides: { name: project.name },
    });

    const uniqueSlug = await this.ensureUniqueSlug(db, metadata.slug);
    const updated = await projectRepository.updateProjectRecord(db, project.id, {
      slug: uniqueSlug,
    });

    if (!updated) {
      throw new Error('Failed to assign slug for project.');
    }

    return updated;
  }

  async updateProject(
    db: D1Database,
    id: string,
    patch: {
      name?: string;
      slug?: string;
      repoUrl?: string;
      description?: string;
      category?: string;
      tags?: string[];
      isPublic?: boolean;
    },
  ): Promise<Project | null> {
    if (patch.slug !== undefined) {
      const existing = await projectRepository.getProjectById(db, id);
      if (!existing) {
        return null;
      }

      const normalizedSlug = slugify(patch.slug);
      const taken = await projectRepository.slugExists(
        db,
        normalizedSlug,
        id,
      );
      if (taken) {
        throw new ValidationError('Slug is already in use.');
      }
      patch.slug = normalizedSlug;
    }

    return projectRepository.updateProjectRecord(db, id, patch);
  }

  async updateProjectDeployment(
    db: D1Database,
    id: string,
    patch: {
      status?: Project['status'];
      lastDeployed?: string;
      url?: string;
      deployTarget?: Project['deployTarget'];
      providerUrl?: string;
      cloudflareProjectName?: string;
    },
  ): Promise<Project | null> {
    return projectRepository.updateProjectDeploymentRecord(db, id, patch);
  }

  async getProjectById(db: D1Database, id: string): Promise<Project | null> {
    return projectRepository.getProjectById(db, id);
  }

  async getProjectByIdIncludingDeleted(
    db: D1Database,
    id: string,
  ): Promise<Project | null> {
    return projectRepository.getProjectByIdIncludingDeleted(db, id);
  }

  async softDeleteProject(db: D1Database, id: string): Promise<boolean> {
    return projectRepository.softDeleteProject(db, id);
  }

  async restoreProject(db: D1Database, id: string): Promise<boolean> {
    return projectRepository.restoreProject(db, id);
  }

  async findProjectByRepoForUser(
    db: D1Database,
    ownerId: string,
    repoUrl: string,
  ): Promise<Project | null> {
    return projectRepository.findByRepoUrlAndOwner(db, repoUrl, ownerId);
  }

  async deleteProject(
    db: D1Database,
    id: string,
    ownerId: string,
  ): Promise<boolean> {
    const project = await projectRepository.getProjectById(db, id);
    if (!project || !project.ownerId || project.ownerId !== ownerId) {
      return false;
    }

    // Best-effort cleanup of engagement/analytics tied to this project.
    if (project.id) {
      await engagementService.deleteEngagementForProject(db, project.id);
    }
    if (project.slug) {
      // Remove analytics time series for this slug so dashboards stay clean.
      await analyticsService.deleteStatsForSlug(db, project.slug);
      // Note: We used to record tombstones, but now we allow slug reuse
      // to avoid permanently occupying namespace.
    }

    return projectRepository.hardDeleteProject(db, id, ownerId);
  }



  /**
   * Generate a unique slug using hybrid strategy:
   * 1. Try base slug
   * 2. Try numeric suffixes: my-app-2, my-app-3, my-app-4
   * 3. If still conflicts, use random suffix: my-app-7k9x
   */
  private async ensureUniqueSlug(
    db: D1Database,
    baseSlug: string,
  ): Promise<string> {
    const normalized = slugify(baseSlug);

    // Try base slug first
    if (!(await projectRepository.slugExists(db, normalized))) {
      return normalized;
    }

    // Try numeric suffixes (2-4)
    for (let suffix = 2; suffix <= 4; suffix++) {
      const candidate = `${normalized}-${suffix}`;
      if (!(await projectRepository.slugExists(db, candidate))) {
        return candidate;
      }
    }

    // Generate random suffix (4 chars: 36^4 = 1.6M combinations)
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const randomCandidate = `${normalized}-${randomSuffix}`;

    // Final fallback: if random still conflicts, add timestamp
    if (await projectRepository.slugExists(db, randomCandidate)) {
      return `${normalized}-${Date.now().toString(36)}`;
    }

    return randomCandidate;
  }
}

export const projectService = new ProjectService();
