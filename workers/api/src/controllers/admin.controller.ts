import { projectService } from '../services/project.service';
import { jsonResponse, readJson } from '../utils/http';
import { UnauthorizedError, NotFoundError, ValidationError } from '../utils/error-handler';
import { getSessionIdFromRequest } from '../utils/auth';
import { authRepository } from '../repositories/auth.repository';
import { configService } from '../services/config.service';
import { sdkCloudRepository, type CloudDbPermissionMode } from '../repositories/sdk-cloud.repository';
import type { ApiWorkerEnv } from '../types/env';

class AdminController {
  private async requireAdmin(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
  ) {
    const sessionId = getSessionIdFromRequest(request);
    if (!sessionId) {
      throw new UnauthorizedError('Admin access requires login.');
    }
    const sessionWithUser = await authRepository.getSessionWithUser(db, sessionId);
    if (!sessionWithUser || !configService.isAdminUser(sessionWithUser.user, env)) {
      throw new UnauthorizedError('Admin access denied.');
    }
    return sessionWithUser.user;
  }

  async listProjects(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
  ): Promise<Response> {
    await this.requireAdmin(request, env, db);

    const url = new URL(request.url);
    const search = url.searchParams.get('search') || undefined;
    const includeDeleted = url.searchParams.get('includeDeleted') !== 'false';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10) || 20),
    );

    const result = await projectService.getProjectsForAdmin(db, {
      search,
      includeDeleted,
      page,
      pageSize,
    });

    return jsonResponse(result);
  }

  async softDeleteProject(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    id: string,
  ): Promise<Response> {
    await this.requireAdmin(request, env, db);
    const project = await projectService.getProjectByIdIncludingDeleted(db, id);
    if (!project) {
      throw new NotFoundError('Project not found');
    }
    const deleted = await projectService.softDeleteProject(db, id);
    if (!deleted) {
      throw new NotFoundError('Project not found');
    }
    return new Response(null, { status: 204 });
  }

  async restoreProject(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    id: string,
  ): Promise<Response> {
    await this.requireAdmin(request, env, db);
    const project = await projectService.getProjectByIdIncludingDeleted(db, id);
    if (!project) {
      throw new NotFoundError('Project not found');
    }
    const restored = await projectService.restoreProject(db, id);
    if (!restored) {
      throw new NotFoundError('Project not found');
    }
    return new Response(null, { status: 204 });
  }

  private normalizeSlug(raw: string, label: string): string {
    const value = String(raw ?? '').trim();
    if (!value) throw new ValidationError(`${label} is required`);
    if (value.length > 64) throw new ValidationError(`${label} is too long`);
    if (!/^[a-z0-9][a-z0-9-_]*$/.test(value)) throw new ValidationError(`${label} is invalid`);
    return value;
  }

  private normalizeDbPermissionMode(raw: unknown): CloudDbPermissionMode {
    const mode = typeof raw === 'string' ? raw.trim() : '';
    if (
      mode === 'visibility_owner_or_public' ||
      mode === 'all_read_creator_write' ||
      mode === 'creator_read_write' ||
      mode === 'all_read_readonly' ||
      mode === 'none'
    ) {
      return mode;
    }
    throw new ValidationError('invalid permission mode');
  }

  async getCloudDbCollectionPermission(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    appIdRaw: string,
    collectionRaw: string,
  ): Promise<Response> {
    await this.requireAdmin(request, env, db);
    const appId = this.normalizeSlug(appIdRaw, 'appId');
    const collection = this.normalizeSlug(collectionRaw, 'collection');
    const row = await sdkCloudRepository.getDbCollectionPermission(db, { appId, collection });
    return jsonResponse({
      appId,
      collection,
      mode: row?.mode ?? 'visibility_owner_or_public',
      updatedAt: row?.updatedAt ?? null,
    });
  }

  async setCloudDbCollectionPermission(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    appIdRaw: string,
    collectionRaw: string,
  ): Promise<Response> {
    await this.requireAdmin(request, env, db);
    const appId = this.normalizeSlug(appIdRaw, 'appId');
    const collection = this.normalizeSlug(collectionRaw, 'collection');
    const body = (await readJson(request)) as { mode?: unknown };
    const mode = this.normalizeDbPermissionMode(body?.mode);
    const row = await sdkCloudRepository.setDbCollectionPermission(db, {
      appId,
      collection,
      mode,
      updatedAt: Date.now(),
    });
    return jsonResponse(row);
  }
}

export const adminController = new AdminController();
