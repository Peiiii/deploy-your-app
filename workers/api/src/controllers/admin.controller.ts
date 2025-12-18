import { projectService } from '../services/project.service';
import { jsonResponse } from '../utils/http';
import { UnauthorizedError, NotFoundError } from '../utils/error-handler';
import { getSessionIdFromRequest } from '../utils/auth';
import { authRepository } from '../repositories/auth.repository';
import { configService } from '../services/config.service';
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
}

export const adminController = new AdminController();
