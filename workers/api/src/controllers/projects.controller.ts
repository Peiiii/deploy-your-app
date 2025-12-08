import type { ApiWorkerEnv } from '../types/env';
import { SourceType, type ProjectMetadataOverrides } from '../types/project';
import { jsonResponse, readJson } from '../utils/http';
import {
  ValidationError,
  NotFoundError,
  UnauthorizedError,
} from '../utils/error-handler';
import {
  validateRequiredString,
  validateOptionalString,
  validateOptionalArray,
} from '../utils/validation';
import { projectService } from '../services/project.service';
import { getSessionIdFromRequest } from '../utils/auth';
import { authRepository } from '../repositories/auth.repository';

class ProjectsController {
  private parseMetadataOverrides(
    value: unknown,
  ): ProjectMetadataOverrides | undefined {
    if (!value || typeof value !== 'object') {
      return undefined;
    }
    const input = value as Record<string, unknown>;
    const metadata: ProjectMetadataOverrides = {};

    if (typeof input.name === 'string') {
      metadata.name = input.name;
    }
    if (typeof input.slug === 'string') {
      metadata.slug = input.slug;
    }
    if (typeof input.description === 'string') {
      metadata.description = input.description;
    }
    if (typeof input.category === 'string') {
      metadata.category = input.category;
    }
    if (Array.isArray(input.tags)) {
      metadata.tags = input.tags
        .filter((tag): tag is string => typeof tag === 'string')
        .map((tag) => tag);
    }

    return metadata;
  }

  private toSourceType(value: unknown): SourceType | undefined {
    if (typeof value !== 'string') return undefined;
    return Object.values(SourceType).includes(value as SourceType)
      ? (value as SourceType)
      : undefined;
  }

  // GET /api/v1/projects
  async listProjects(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
  ): Promise<Response> {
    // Public endpoint: Explore page shows all projects across users.
    const projects = await projectService.getProjects(db);
    return jsonResponse(projects);
  }

  // POST /api/v1/projects
  async createProject(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
  ): Promise<Response> {
    const sessionId = getSessionIdFromRequest(request);
    if (!sessionId) {
      throw new UnauthorizedError('Login required to create a project.');
    }
    const sessionWithUser = await authRepository.getSessionWithUser(
      db,
      sessionId,
    );
    if (!sessionWithUser) {
      throw new UnauthorizedError('Login required to create a project.');
    }

    const body = await readJson(request);
    const name = validateRequiredString(body.name, 'name');
    const identifier = validateRequiredString(body.identifier, 'identifier');

    const project = await projectService.createProject(env, db, {
      name,
      identifier,
      sourceType: this.toSourceType(body.sourceType),
      htmlContent: validateOptionalString(body.htmlContent),
      metadata: this.parseMetadataOverrides(body.metadata),
      ownerId: sessionWithUser.user.id,
    });

    return jsonResponse(project);
  }

  // PATCH /api/v1/projects/:id
  async updateProject(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    id: string,
  ): Promise<Response> {
    const body = await readJson(request);

    const { name, repoUrl, description, category, tags } = body;
    if (
      name === undefined &&
      repoUrl === undefined &&
      description === undefined &&
      category === undefined &&
      tags === undefined
    ) {
      throw new ValidationError(
        'At least one of name, repoUrl, description, category or tags must be provided',
      );
    }

    const project = await projectService.updateProject(db, id, {
      ...(name !== undefined
        ? { name: validateRequiredString(name, 'name') }
        : {}),
      ...(repoUrl !== undefined
        ? { repoUrl: validateRequiredString(repoUrl, 'repoUrl') }
        : {}),
      ...(description !== undefined
        ? { description: validateOptionalString(description) }
        : {}),
      ...(category !== undefined
        ? { category: validateOptionalString(category) }
        : {}),
      ...(tags !== undefined
        ? { tags: validateOptionalArray(tags, (tag) => String(tag)) }
        : {}),
    });

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    return jsonResponse(project);
  }
}

export const projectsController = new ProjectsController();
