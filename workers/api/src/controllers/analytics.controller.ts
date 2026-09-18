import { jsonResponse, emptyResponse, readJson } from '../utils/http';
import { ValidationError } from '../utils/error-handler';
import { analyticsService } from '../services/analytics.service';
import { projectService } from '../services/project.service';
import type { ApiWorkerEnv } from '../types/env';
import type { PageViewSignal } from '../repositories/analytics.repository';

const safeText = (value: unknown, max = 80): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  return /^[a-z0-9._:+-]+$/.test(normalized) && normalized.length <= max
    ? normalized
    : undefined;
};

const secureEqual = async (left: string, right: string): Promise<boolean> => {
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(left)),
    crypto.subtle.digest('SHA-256', encoder.encode(right)),
  ]);
  const a = new Uint8Array(leftHash);
  const b = new Uint8Array(rightHash);
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a[i] ^ b[i];
  return mismatch === 0;
};

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
    const configuredSecret = env.ANALYTICS_INGEST_SECRET;
    const providedSecret = request.headers.get('x-gemigo-analytics-token') ?? '';
    if (
      !configuredSecret ||
      !providedSecret ||
      !(await secureEqual(providedSecret, configuredSecret))
    ) {
      return emptyResponse(404);
    }
    const body = await readJson(request);
    const signal: PageViewSignal = {
      isBot: body.isBot === true,
      visitorHash: safeText(body.visitorHash, 64) ?? '',
      sessionHash: safeText(body.sessionHash, 64) ?? '',
      dedupeKey: safeText(body.dedupeKey, 64) ?? '',
      userAgentFamily: safeText(body.userAgentFamily, 24) ?? 'other',
      referrerHost: safeText(body.referrerHost, 120),
      utmSource: safeText(body.utmSource),
      utmMedium: safeText(body.utmMedium),
      utmCampaign: safeText(body.utmCampaign),
      clientChannel: safeText(body.clientChannel, 24) ?? 'web',
    };
    if (!signal.visitorHash || !signal.sessionHash || !signal.dedupeKey) {
      throw new ValidationError('Invalid analytics signal');
    }
    await analyticsService.recordPageView(db, normalizedSlug, new Date(), signal);
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
