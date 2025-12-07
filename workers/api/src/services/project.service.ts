import type { ApiWorkerEnv } from '../types/env';
import {
  SourceType,
  type Project,
  type ProjectMetadataOverrides,
} from '../types/project';
import { slugify } from '../utils/strings';
import { ProjectRepository } from '../repositories/project.repository';
import { MetadataService } from './metadata.service';

interface CreateProjectInput {
  name: string;
  identifier: string;
  sourceType?: SourceType;
  htmlContent?: string;
  metadata?: ProjectMetadataOverrides;
}

export class ProjectService {
  constructor(
    private readonly repository: ProjectRepository,
    private readonly metadataService: MetadataService,
    private readonly env: ApiWorkerEnv,
  ) {}

  async getProjects(): Promise<Project[]> {
    return this.repository.getAllProjects();
  }

  async createProject(input: CreateProjectInput): Promise<Project> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const normalizedSourceType = input.sourceType ?? SourceType.GitHub;
    const slugSeed = slugify(input.name);

    const metadata = await this.metadataService.ensureProjectMetadata({
      seedName: input.name,
      identifier: input.identifier,
      sourceType: normalizedSourceType,
      htmlContent: input.htmlContent,
      slugSeed,
      overrides: input.metadata,
    });

    const deployTarget = this.resolveDeployTarget();
    const url = this.buildProjectUrl(metadata.slug, deployTarget);

    return this.repository.createProjectRecord({
      id,
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
    id: string,
    patch: {
      name?: string;
      repoUrl?: string;
      description?: string;
      category?: string;
      tags?: string[];
    },
  ): Promise<Project | null> {
    return this.repository.updateProjectRecord(id, patch);
  }

  private resolveDeployTarget(): Project['deployTarget'] {
    const raw = this.env.DEPLOY_TARGET?.toLowerCase();
    if (raw === 'cloudflare' || raw === 'local' || raw === 'r2') {
      return raw;
    }
    return 'r2';
  }

  private buildProjectUrl(
    slug: string,
    target: Project['deployTarget'],
  ): string | undefined {
    if (target === 'local') {
      return `/apps/${encodeURIComponent(slug)}/`;
    }
    if (target === 'r2') {
      const domain = this.env.APPS_ROOT_DOMAIN?.trim();
      if (domain) {
        return `https://${slug}.${domain}/`;
      }
    }
    return undefined;
  }
}
