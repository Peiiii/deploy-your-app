import type { ApiWorkerEnv } from '../types/env';
import { jsonResponse } from '../utils/http';
import { UnauthorizedError, ValidationError } from '../utils/error-handler';
import { getSessionIdFromRequest } from '../utils/auth';
import { authRepository } from '../repositories/auth.repository';
import { projectService } from '../services/project.service';
import { engagementService } from '../services/engagement.service';

class EngagementController {
  private async requireUser(
    request: Request,
    db: D1Database,
  ): Promise<{ userId: string }> {
    const sessionId = getSessionIdFromRequest(request);
    if (!sessionId) {
      throw new UnauthorizedError('Login required.');
    }
    const sessionWithUser = await authRepository.getSessionWithUser(
      db,
      sessionId,
    );
    if (!sessionWithUser) {
      throw new UnauthorizedError('Login required.');
    }
    return { userId: sessionWithUser.user.id };
  }

  // GET /api/v1/projects/:id/reactions
  async getReactionsForProject(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    projectId: string,
  ): Promise<Response> {
    const { userId } = await this.requireUser(request, db);
    const project = await projectService.getProjectById(db, projectId);
    if (!project) {
      throw new ValidationError('Project not found');
    }
    const reactions = await engagementService.getReactionsForProject(
      db,
      projectId,
      userId,
    );
    return jsonResponse(reactions);
  }

  // GET /api/v1/projects/reactions?ids=1,2,3
  async getReactionsForProjectsBulk(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
  ): Promise<Response> {
    const { userId } = await this.requireUser(request, db);
    const url = new URL(request.url);
    const idsParam = url.searchParams.get('ids');

    if (!idsParam) {
      return jsonResponse({});
    }

    const rawIds = idsParam
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    const uniqueIds = Array.from(new Set(rawIds));
    if (uniqueIds.length === 0) {
      return jsonResponse({});
    }

    const result: Record<string, Awaited<
      ReturnType<typeof engagementService.getReactionsForProject>
    >> = {};

    for (const projectId of uniqueIds) {
      try {
        const reactions = await engagementService.getReactionsForProject(
          db,
          projectId,
          userId,
        );
        result[projectId] = reactions;
      } catch (error) {
        // Swallow errors for individual projects so that one bad ID
        // doesn't break the whole batch.
        console.error(
          'Failed to load reactions for project in bulk call',
          projectId,
          error,
        );
      }
    }

    return jsonResponse(result);
  }

  // POST /api/v1/projects/:id/like
  async likeProject(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    projectId: string,
  ): Promise<Response> {
    const { userId } = await this.requireUser(request, db);
    const project = await projectService.getProjectById(db, projectId);
    if (!project) {
      throw new ValidationError('Project not found');
    }
    const reactions = await engagementService.setLike(
      db,
      projectId,
      userId,
      true,
    );
    return jsonResponse(reactions);
  }

  // DELETE /api/v1/projects/:id/like
  async unlikeProject(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    projectId: string,
  ): Promise<Response> {
    const { userId } = await this.requireUser(request, db);
    const project = await projectService.getProjectById(db, projectId);
    if (!project) {
      throw new ValidationError('Project not found');
    }
    const reactions = await engagementService.setLike(
      db,
      projectId,
      userId,
      false,
    );
    return jsonResponse(reactions);
  }

  // POST /api/v1/projects/:id/favorite
  async favoriteProject(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    projectId: string,
  ): Promise<Response> {
    const { userId } = await this.requireUser(request, db);
    const project = await projectService.getProjectById(db, projectId);
    if (!project) {
      throw new ValidationError('Project not found');
    }
    const reactions = await engagementService.setFavorite(
      db,
      projectId,
      userId,
      true,
    );
    return jsonResponse(reactions);
  }

  // DELETE /api/v1/projects/:id/favorite
  async unfavoriteProject(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    projectId: string,
  ): Promise<Response> {
    const { userId } = await this.requireUser(request, db);
    const project = await projectService.getProjectById(db, projectId);
    if (!project) {
      throw new ValidationError('Project not found');
    }
    const reactions = await engagementService.setFavorite(
      db,
      projectId,
      userId,
      false,
    );
    return jsonResponse(reactions);
  }

  // GET /api/v1/me/favorites
  async listFavoritesForCurrentUser(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
  ): Promise<Response> {
    const { userId } = await this.requireUser(request, db);
    const projectIds =
      await engagementService.getFavoriteProjectIdsForUser(db, userId);
    return jsonResponse({ projectIds });
  }
}

export const engagementController = new EngagementController();
