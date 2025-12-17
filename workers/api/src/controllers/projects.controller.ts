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

/**
 * ProjectsController - Handles HTTP requests for project CRUD operations.
 * Auth logic is centralized in requireAuth() to reduce duplication.
 */
class ProjectsController {
  // ─────────────────────────────────────────────────────────────
  // Auth helper
  // ─────────────────────────────────────────────────────────────

  private async requireAuth(request: Request, db: D1Database, action: string) {
    const sessionId = getSessionIdFromRequest(request);
    if (!sessionId) {
      throw new UnauthorizedError(`Login required to ${action}.`);
    }
    const session = await authRepository.getSessionWithUser(db, sessionId);
    if (!session) {
      throw new UnauthorizedError(`Login required to ${action}.`);
    }
    return session.user;
  }

  private async requireProjectOwner(
    db: D1Database,
    projectId: string,
    userId: string,
    action: string,
  ) {
    const project = await projectService.getProjectById(db, projectId);
    if (!project) {
      throw new NotFoundError('Project not found');
    }
    if (project.ownerId !== userId) {
      throw new UnauthorizedError(`Only the project owner can ${action}.`);
    }
    return project;
  }

  // ─────────────────────────────────────────────────────────────
  // Input parsing helpers
  // ─────────────────────────────────────────────────────────────

  private parseMetadataOverrides(value: unknown): ProjectMetadataOverrides | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const input = value as Record<string, unknown>;
    const metadata: ProjectMetadataOverrides = {};
    if (typeof input.name === 'string') metadata.name = input.name;
    if (typeof input.slug === 'string') metadata.slug = input.slug;
    if (typeof input.description === 'string') metadata.description = input.description;
    if (typeof input.category === 'string') metadata.category = input.category;
    if (Array.isArray(input.tags)) {
      metadata.tags = input.tags.filter((t): t is string => typeof t === 'string');
    }
    return metadata;
  }

  private toSourceType(value: unknown): SourceType | undefined {
    if (typeof value !== 'string') return undefined;
    return Object.values(SourceType).includes(value as SourceType)
      ? (value as SourceType)
      : undefined;
  }

  // ─────────────────────────────────────────────────────────────
  // Public endpoints (no auth)
  // ─────────────────────────────────────────────────────────────

  /** GET /api/v1/projects */
  async listProjects(_request: Request, _env: ApiWorkerEnv, db: D1Database): Promise<Response> {
    const projects = await projectService.getProjects(db);
    return jsonResponse(projects);
  }

  /** GET /api/v1/projects/explore */
  async listExploreProjects(request: Request, _env: ApiWorkerEnv, db: D1Database): Promise<Response> {
    const url = new URL(request.url);
    const sortParam = url.searchParams.get('sort');
    const result = await projectService.getExploreProjects(db, {
      search: url.searchParams.get('search')?.trim() || undefined,
      category: url.searchParams.get('category')?.trim() || undefined,
      tag: url.searchParams.get('tag')?.trim() || undefined,
      sort: sortParam === 'popularity' ? 'popularity' : 'recent',
      page: Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1),
      pageSize: Math.min(50, Math.max(1, parseInt(url.searchParams.get('pageSize') || '12', 10) || 12)),
    });
    return jsonResponse(result);
  }

  // ─────────────────────────────────────────────────────────────
  // Authenticated endpoints
  // ─────────────────────────────────────────────────────────────

  /** GET /api/v1/projects/by-repo?repoUrl=... */
  async findProjectByRepo(request: Request, _env: ApiWorkerEnv, db: D1Database): Promise<Response> {
    const user = await this.requireAuth(request, db, 'inspect projects');
    const url = new URL(request.url);
    const repoUrl = validateRequiredString(url.searchParams.get('repoUrl'), 'repoUrl');
    const project = await projectService.findProjectByRepoForUser(db, user.id, repoUrl);
    return jsonResponse({ project });
  }

  /** POST /api/v1/projects */
  async createProject(request: Request, env: ApiWorkerEnv, db: D1Database): Promise<Response> {
    const user = await this.requireAuth(request, db, 'create a project');
    const body = await readJson(request);
    const project = await projectService.createProject(env, db, {
      name: validateRequiredString(body.name, 'name'),
      identifier: validateRequiredString(body.identifier, 'identifier'),
      sourceType: this.toSourceType(body.sourceType),
      htmlContent: validateOptionalString(body.htmlContent),
      metadata: this.parseMetadataOverrides(body.metadata),
      ownerId: user.id,
    });
    return jsonResponse(project);
  }

  /** POST /api/v1/projects/draft */
  async createDraftProject(request: Request, env: ApiWorkerEnv, db: D1Database): Promise<Response> {
    const user = await this.requireAuth(request, db, 'create a project');
    const body = await readJson(request);
    const project = await projectService.createDraftProject(env, db, {
      name: validateOptionalString(body.name),
      ownerId: user.id,
      isPublic: true,
    });
    return jsonResponse(project);
  }

  /** PATCH /api/v1/projects/:id */
  async updateProject(request: Request, _env: ApiWorkerEnv, db: D1Database, id: string): Promise<Response> {
    const user = await this.requireAuth(request, db, 'update a project');
    await this.requireProjectOwner(db, id, user.id, 'update it');

    const body = await readJson(request);
    const { name, slug, repoUrl, description, category, tags, isPublic } = body;

    if ([name, slug, repoUrl, description, category, tags, isPublic].every((v) => v === undefined)) {
      throw new ValidationError('At least one field must be provided');
    }
    if (isPublic !== undefined && typeof isPublic !== 'boolean') {
      throw new ValidationError('isPublic must be a boolean');
    }

    const project = await projectService.updateProject(db, id, {
      ...(name !== undefined && { name: validateRequiredString(name, 'name') }),
      ...(slug !== undefined && { slug: validateRequiredString(slug, 'slug') }),
      ...(repoUrl !== undefined && { repoUrl: validateRequiredString(repoUrl, 'repoUrl') }),
      ...(description !== undefined && { description: validateOptionalString(description) }),
      ...(category !== undefined && { category: validateOptionalString(category) }),
      ...(tags !== undefined && { tags: validateOptionalArray(tags, String) }),
      ...(isPublic !== undefined && { isPublic }),
    });

    if (!project) throw new NotFoundError('Project not found');
    return jsonResponse(project);
  }

  /** PATCH /api/v1/projects/:id/deployment */
  async updateProjectDeployment(request: Request, _env: ApiWorkerEnv, db: D1Database, id: string): Promise<Response> {
    const user = await this.requireAuth(request, db, 'update deployment status');
    await this.requireProjectOwner(db, id, user.id, 'update deployment status');

    const body = await readJson(request);
    const status = validateOptionalString(body.status);
    const deployTarget = validateOptionalString(body.deployTarget);

    if (status && !['Live', 'Building', 'Failed', 'Offline'].includes(status)) {
      throw new ValidationError('status must be one of: Live, Building, Failed, Offline');
    }
    if (deployTarget && !['local', 'cloudflare', 'r2'].includes(deployTarget)) {
      throw new ValidationError('deployTarget must be one of: local, cloudflare, r2');
    }

    const patch = {
      ...(status && { status: status as 'Live' | 'Building' | 'Failed' | 'Offline' }),
      ...(body.lastDeployed !== undefined && { lastDeployed: validateRequiredString(body.lastDeployed, 'lastDeployed') }),
      ...(body.url !== undefined && { url: validateOptionalString(body.url) }),
      ...(deployTarget && { deployTarget: deployTarget as 'local' | 'cloudflare' | 'r2' }),
      ...(body.providerUrl !== undefined && { providerUrl: validateOptionalString(body.providerUrl) }),
      ...(body.cloudflareProjectName !== undefined && { cloudflareProjectName: validateOptionalString(body.cloudflareProjectName) }),
    };

    if (Object.keys(patch).length === 0) {
      throw new ValidationError('At least one field must be provided');
    }

    const updated = await projectService.updateProjectDeployment(db, id, patch);
    if (!updated) throw new NotFoundError('Project not found');
    return jsonResponse(updated);
  }

  /** DELETE /api/v1/projects/:id */
  async deleteProject(request: Request, _env: ApiWorkerEnv, db: D1Database, id: string): Promise<Response> {
    const user = await this.requireAuth(request, db, 'delete a project');
    const deleted = await projectService.deleteProject(db, id, user.id);
    if (!deleted) throw new NotFoundError('Project not found');
    return new Response(null, { status: 204 });
  }

  /** POST /api/v1/projects/:id/thumbnail */
  async uploadThumbnail(request: Request, env: ApiWorkerEnv, db: D1Database, id: string): Promise<Response> {
    const user = await this.requireAuth(request, db, 'upload a thumbnail');
    const project = await this.requireProjectOwner(db, id, user.id, 'upload a thumbnail');

    if (configService.getDeployTarget(env) !== 'r2') {
      throw new ValidationError('Thumbnail upload is only supported when deploy target is "r2".');
    }

    const bucket = env.ASSETS;
    if (!bucket) {
      throw new ConfigurationError('R2 bucket binding "ASSETS" is not configured.');
    }

    if (!project.slug?.trim()) {
      throw new ValidationError('Project slug is missing. Deploy the project first.');
    }

    const formData = await request.formData();
    const entry = formData.get('file');
    if (!entry || typeof entry === 'string') {
      throw new ValidationError('Missing image file in form field "file".');
    }

    const file = entry as File;
    if (!file.type?.startsWith('image/')) {
      throw new ValidationError('Only image uploads are supported.');
    }
    if (file.size > 4 * 1024 * 1024) {
      throw new ValidationError('Thumbnail image is too large (max 4MB).');
    }

    await bucket.put(`apps/${project.slug}/thumbnail.png`, file.stream(), {
      httpMetadata: { contentType: file.type },
    });

    const appsRootDomain = configService.getAppsRootDomain(env);
    return jsonResponse({
      ok: true,
      thumbnailUrl: `https://${project.slug}.${appsRootDomain}/__thumbnail.png`,
    });
  }
}

export const projectsController = new ProjectsController();
