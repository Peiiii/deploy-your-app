import { randomUUID } from 'crypto';
import {
  APPS_ROOT_DOMAIN,
  DEPLOY_TARGET,
} from '../../common/config/config.js';
import {
  createProjectRecord,
  type CreateProjectRecordInput,
  getAllProjects,
  updateProjectRecord,
} from './projectRepository.js';
import type { Project } from '../../common/types.js';
import { SourceType } from '../../common/types.js';
import { slugify } from '../../common/utils/strings.js';
import {
  metadataService,
  type ProjectMetadataOverrides,
} from '../metadata/index.js';

// Type definitions
interface CreateProjectInput {
  name: string;
  sourceType?: SourceType;
  identifier: string;
  htmlContent?: string;
  metadata?: ProjectMetadataOverrides;
}

export class ProjectService {
  getProjects(): Project[] {
    return getAllProjects();
  }

  async createProject({
    name,
    sourceType,
    identifier,
    htmlContent,
    metadata,
  }: CreateProjectInput): Promise<Project> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const initialSlug = slugify(name);
    const normalizedSourceType = sourceType ?? SourceType.GitHub;

    // For local deployments, we can compute the URL eagerly.
    // For R2 deployments, the public URL is also deterministic:
    //   https://<slug>.<APPS_ROOT_DOMAIN>/
    // For legacy Cloudflare Pages deployments, the final URL is only known
    // after the first successful deploy, so we leave it undefined and let the
    // deployment pipeline fill it in.
    let url: string | undefined;
    const resolvedMetadata = await metadataService.ensureProjectMetadata({
      seedName: name,
      identifier,
      sourceType: normalizedSourceType,
      htmlContent,
      slugSeed: initialSlug,
      overrides: metadata,
    });

    const finalName = resolvedMetadata.name;
    const finalSlug = resolvedMetadata.slug;
    const category = resolvedMetadata.category;
    const tags = resolvedMetadata.tags;
    const description = resolvedMetadata.description;

    if (DEPLOY_TARGET === 'local') {
      url = `/apps/${encodeURIComponent(finalSlug)}/`;
    } else if (DEPLOY_TARGET === 'r2') {
      url = `https://${finalSlug}.${APPS_ROOT_DOMAIN}/`;
    }

    const project: Project = {
      id,
      name: finalName,
      repoUrl: identifier,
      sourceType: normalizedSourceType,
      slug: finalSlug,
      lastDeployed: now,
      status: 'Live',
      url,
      description,
      framework: 'Unknown',
      category,
      tags,
      deployTarget: DEPLOY_TARGET,
      htmlContent,
    };
    const recordInput: CreateProjectRecordInput = {
      id,
      name: finalName,
      repoUrl: identifier,
      sourceType: normalizedSourceType,
      slug: finalSlug,
      lastDeployed: now,
      status: project.status,
      url,
      description,
      framework: project.framework,
      category,
      tags,
      deployTarget: project.deployTarget,
      htmlContent,
    };

    // Persist to the local SQLite database so that project list survives
    // backend restarts during development.
    createProjectRecord(recordInput);

    return project;
  }

  updateProject(
    id: string,
    input: {
      name?: string;
      repoUrl?: string;
      description?: string;
      category?: string;
      tags?: string[];
    },
  ): Project | null {
    return updateProjectRecord(id, input);
  }
}

export const projectService = new ProjectService();
