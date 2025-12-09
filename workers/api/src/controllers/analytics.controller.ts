import type { ApiWorkerEnv } from '../types/env';
import { jsonResponse, emptyResponse } from '../utils/http';
import { ValidationError } from '../utils/error-handler';
import { analyticsService } from '../services/analytics.service';
import { analyticsRepository } from '../repositories/analytics.repository';
import { projectService } from '../services/project.service';

class AnalyticsController {
  // Internal endpoint – used by the R2 gateway Worker to record page views.
  // GET /api/v1/analytics/ping/:slug
  async pingPageView(
    request: Request,
    env: ApiWorkerEnv,
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

  // Debug endpoint: inspect raw rows for a given slug.
  // GET /api/v1/analytics/debug/raw?slug=...&from=YYYY-MM-DD
  async debugRawStats(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
  ): Promise<Response> {
    const url = new URL(request.url);
    const slug = (url.searchParams.get('slug') || '').trim();
    if (!slug) {
      throw new ValidationError('slug is required');
    }
    const from = url.searchParams.get('from') || '1970-01-01';
    const rows = await analyticsRepository.getStatsForSlug(db, slug, from);
    return jsonResponse({ slug, from, rows });
  }

  // GET /api/v1/projects/:id/stats?range=7d
  async getProjectStats(
    request: Request,
    env: ApiWorkerEnv,
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
