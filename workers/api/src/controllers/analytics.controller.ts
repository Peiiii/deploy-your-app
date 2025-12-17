import { jsonResponse, emptyResponse } from '../utils/http';
import { ValidationError } from '../utils/error-handler';
import { analyticsService } from '../services/analytics.service';
import { projectService } from '../services/project.service';

class AnalyticsController {
  // Internal endpoint – used by the R2 gateway Worker to record page views.
  // GET /api/v1/analytics/ping/:slug
  async pingPageView(
    db: D1Database,
    slug: string,
  ): Promise<Response> {
    const normalizedSlug = slug.trim();
    if (!normalizedSlug) {
      throw new ValidationError('slug is required');
    }
    const now = new Date();
    await analyticsService.recordPageView(db, normalizedSlug, now);
    return emptyResponse(204);
  }

  // GET /api/v1/projects/:id/stats?range=7d
  async getProjectStats(
    request: Request,
    db: D1Database,
    projectId: string,
  ): Promise<Response> {
    const project = await projectService.getProjectById(db, projectId);
    if (!project) {
      throw new ValidationError('Project not found');
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
