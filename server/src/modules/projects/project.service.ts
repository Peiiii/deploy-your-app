import { randomUUID } from 'crypto';
import {
  DEPLOY_TARGET
} from '../../common/config/config.js';
import type { Project } from '../../common/types.js';
import { SourceType } from '../../common/types.js';
import { slugify } from '../../common/utils/strings.js';
import {
  metadataService,
  type ProjectMetadataOverrides,
} from '../metadata/index.js';
import {
  projectRepository,
  type CreateProjectRecordInput,
} from './repositories/index.js';

// Type definitions
interface CreateProjectInput {
  name: string;
  sourceType?: SourceType;
  identifier: string;
  htmlContent?: string;
  metadata?: ProjectMetadataOverrides;
}

export class ProjectService {
  async getProjects(): Promise<Project[]> {
    return projectRepository.getAllProjects();
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
    const normalizedSourceType = sourceType ?? SourceType.GitHub;

    // No slug on creation. It will be set either by user input or after first deploy.
    // Also leave url undefined until slug is known.
    let url: string | undefined;
    const resolvedMetadata = await metadataService.ensureProjectMetadata({
      seedName: name,
      identifier,
      sourceType: normalizedSourceType,
      htmlContent,
      slugSeed: slugify(name),
      overrides: metadata,
    });

    const finalName = resolvedMetadata.name;
    const category = resolvedMetadata.category;
    const tags = resolvedMetadata.tags;
    const description = resolvedMetadata.description;

    const project: Project = {
      id,
      name: finalName,
      repoUrl: identifier,
      sourceType: normalizedSourceType,
      slug: undefined,
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
      slug: undefined,
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
    await projectRepository.createProjectRecord(recordInput);

    return project;
  }

  async updateProject(
    id: string,
    input: {
      name?: string;
      repoUrl?: string;
      description?: string;
      category?: string;
      tags?: string[];
    },
  ): Promise<Project | null> {
    return projectRepository.updateProjectRecord(id, input);
  }
}

export const projectService = new ProjectService();
