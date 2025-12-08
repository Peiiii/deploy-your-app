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

interface CreateProjectInput {
  name: string;
  identifier: string;
  sourceType?: SourceType;
  htmlContent?: string;
  metadata?: ProjectMetadataOverrides;
  ownerId?: string;
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
    },
  ): Promise<Project | null> {
    return projectRepository.updateProjectRecord(db, id, patch);
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
