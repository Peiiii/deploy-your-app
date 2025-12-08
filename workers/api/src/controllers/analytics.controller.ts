import type { ApiWorkerEnv } from '../types/env';
import { jsonResponse, readJson, emptyResponse } from '../utils/http';
import { ValidationError, UnauthorizedError } from '../utils/error-handler';
import { analyticsService } from '../services/analytics.service';
import { projectService } from '../services/project.service';
import { getSessionIdFromRequest } from '../utils/auth';
import { authRepository } from '../repositories/auth.repository';

class AnalyticsController {
  // Internal endpoint – called by the R2 gateway Worker to record page views.
  // POST /api/v1/analytics/pageview
  async recordPageView(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
  ): Promise<Response> {
    const body = await readJson(request);
    const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
    if (!slug) {
      throw new ValidationError('slug is required');
    }

    const timestamp =
      typeof body.timestamp === 'string'
        ? new Date(body.timestamp)
        : new Date();
    if (Number.isNaN(timestamp.getTime())) {
      throw new ValidationError('Invalid timestamp');
    }

    await analyticsService.recordPageView(db, slug, timestamp);
    return emptyResponse(204);
  }

  // GET /api/v1/projects/:id/stats?range=7d
  async getProjectStats(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    projectId: string,
  ): Promise<Response> {
    const sessionId = getSessionIdFromRequest(request);
    if (!sessionId) {
      throw new UnauthorizedError('Login required to view project stats.');
    }
    const sessionWithUser = await authRepository.getSessionWithUser(
      db,
      sessionId,
    );
    if (!sessionWithUser) {
      throw new UnauthorizedError('Login required to view project stats.');
    }

    const project = await projectService.getProjectById(db, projectId);
    if (!project) {
      throw new ValidationError('Project not found');
    }
    if (project.ownerId && project.ownerId !== sessionWithUser.user.id) {
      throw new UnauthorizedError('You do not own this project.');
    }

    const url = new URL(request.url);
    const rangeParam = url.searchParams.get('range') ?? '7d';
    const rangeDays = rangeParam === '30d' ? 30 : 7;

    const stats = await analyticsService.getProjectStats(
      db,
      project,
      rangeDays,
    );
    return jsonResponse(stats);
  }
}

export const analyticsController = new AnalyticsController();

