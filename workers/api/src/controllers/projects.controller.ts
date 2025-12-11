import type { ApiWorkerEnv } from '../types/env';
import { SourceType, type ProjectMetadataOverrides } from '../types/project';
import { jsonResponse, readJson } from '../utils/http';
import {
  ConfigurationError,
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
import { configService } from '../services/config.service';

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

  // GET /api/v1/projects/explore
  async listExploreProjects(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
  ): Promise<Response> {
    const url = new URL(request.url);

    const search = url.searchParams.get('search') ?? undefined;
    const category = url.searchParams.get('category') ?? undefined;
    const tag = url.searchParams.get('tag') ?? undefined;
    const sortParam = url.searchParams.get('sort') ?? undefined;
    const pageParam = url.searchParams.get('page') ?? undefined;
    const pageSizeParam = url.searchParams.get('pageSize') ?? undefined;

    const sort =
      sortParam === 'recent' || sortParam === 'popularity'
        ? sortParam
      : 'recent';

    const page = pageParam ? Number.parseInt(pageParam, 10) : 1;
    const pageSize = pageSizeParam ? Number.parseInt(pageSizeParam, 10) : 12;

    const result = await projectService.getExploreProjects(db, {
      search: search?.trim() || undefined,
      category: category?.trim() || undefined,
      tag: tag?.trim() || undefined,
      sort,
      page: Number.isFinite(page) && page > 0 ? page : 1,
      pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 12,
    });

    return jsonResponse(result);
  }

  // GET /api/v1/projects/by-repo?repoUrl=...
  // Used by the deployment wizard to detect when the current user is trying
  // to deploy a GitHub repository they already have a project for, so we can
  // guide them towards redeploy instead of accidentally creating a new
  // project with a conflicting slug / URL.
  async findProjectByRepo(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
  ): Promise<Response> {
    const sessionId = getSessionIdFromRequest(request);
    if (!sessionId) {
      throw new UnauthorizedError('Login required to inspect projects.');
    }
    const sessionWithUser = await authRepository.getSessionWithUser(
      db,
      sessionId,
    );
    if (!sessionWithUser) {
      throw new UnauthorizedError('Login required to inspect projects.');
    }

    const url = new URL(request.url);
    const rawRepoUrl = url.searchParams.get('repoUrl');
    if (!rawRepoUrl) {
      throw new ValidationError('Missing required query parameter: repoUrl');
    }
    const repoUrl = validateRequiredString(rawRepoUrl, 'repoUrl');

    const project = await projectService.findProjectByRepoForUser(
      db,
      sessionWithUser.user.id,
      repoUrl,
    );

    return jsonResponse({ project });
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

    const { name, repoUrl, description, category, tags, isPublic } = body;
    if (
      name === undefined &&
      repoUrl === undefined &&
      description === undefined &&
      category === undefined &&
      tags === undefined &&
      isPublic === undefined
    ) {
      throw new ValidationError(
        'At least one of name, repoUrl, description, category, tags or isPublic must be provided',
      );
    }

    if (isPublic !== undefined && typeof isPublic !== 'boolean') {
      throw new ValidationError('isPublic must be a boolean');
    }

    const project = await projectService.updateProject(db, id, {
      ...(name !== undefined
        ? { name: validateRequiredString(name, 'name') }
        : {}),
      ...(isPublic !== undefined ? { isPublic } : {}),
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

  // DELETE /api/v1/projects/:id
  async deleteProject(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    id: string,
  ): Promise<Response> {
    const sessionId = getSessionIdFromRequest(request);
    if (!sessionId) {
      throw new UnauthorizedError('Login required to delete a project.');
    }
    const sessionWithUser = await authRepository.getSessionWithUser(
      db,
      sessionId,
    );
    if (!sessionWithUser) {
      throw new UnauthorizedError('Login required to delete a project.');
    }

    const deleted = await projectService.deleteProject(
      db,
      id,
      sessionWithUser.user.id,
    );

    if (!deleted) {
      throw new NotFoundError('Project not found');
    }

    return new Response(null, { status: 204 });
  }

  /**
   * POST /api/v1/projects/:id/thumbnail
   *
   * Authenticated endpoint for project owners to upload a custom cover image.
   * The image is stored in the shared R2 bucket under:
   *   apps/<slug>/thumbnail.png
   *
   * The Explore grid and preview cards already request
   *   https://<slug>.<APPS_ROOT_DOMAIN>/__thumbnail.png
   * which the R2 gateway Worker maps to this R2 object, so we don't need
   * any extra schema field on the Project itself.
   */
  async uploadThumbnail(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    id: string,
  ): Promise<Response> {
    const sessionId = getSessionIdFromRequest(request);
    if (!sessionId) {
      throw new UnauthorizedError('Login required to upload a thumbnail.');
    }
    const sessionWithUser = await authRepository.getSessionWithUser(
      db,
      sessionId,
    );
    if (!sessionWithUser) {
      throw new UnauthorizedError('Login required to upload a thumbnail.');
    }

    const project = await projectService.getProjectById(db, id);
    if (!project) {
      throw new NotFoundError('Project not found');
    }
    if (!project.ownerId || project.ownerId !== sessionWithUser.user.id) {
      throw new UnauthorizedError(
        'Only the project owner can upload a thumbnail.',
      );
    }

    const deployTarget = configService.getDeployTarget(env);
    if (deployTarget !== 'r2') {
      throw new ValidationError(
        'Thumbnail upload is only supported when deploy target is "r2".',
      );
    }

    const bucket = env.ASSETS;
    if (!bucket) {
      throw new ConfigurationError(
        'R2 bucket binding "ASSETS" is not configured in the API Worker.',
      );
    }

    if (!project.slug || project.slug.trim().length === 0) {
      throw new ValidationError(
        'Project slug is missing. Deploy the project first before uploading a thumbnail.',
      );
    }

    const formData = await request.formData();
    const entry = formData.get('file');
    // In the Workers runtime, FormData entries are either string or File.
    if (!entry || typeof entry === 'string') {
      throw new ValidationError('Missing image file in form field "file".');
    }
    const file = entry as File;

    if (!file.type || !file.type.startsWith('image/')) {
      throw new ValidationError('Only image uploads are supported.');
    }

    const maxBytes = 4 * 1024 * 1024; // 4MB limit for thumbnails
    if (file.size > maxBytes) {
      throw new ValidationError('Thumbnail image is too large (max 4MB).');
    }

    const key = `apps/${project.slug}/thumbnail.png`;

    await bucket.put(key, file.stream(), {
      httpMetadata: {
        contentType: file.type,
      },
    });

    const appsRootDomain = configService.getAppsRootDomain(env);
    const thumbnailUrl = project.slug
      ? `https://${project.slug}.${appsRootDomain}/__thumbnail.png`
      : undefined;

    return jsonResponse(
      {
        ok: true,
        thumbnailUrl,
      },
      200,
    );
  }
}

export const projectsController = new ProjectsController();
