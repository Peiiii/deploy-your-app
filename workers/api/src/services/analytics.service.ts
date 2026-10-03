import {
  analyticsRepository,
  type PageViewSignal,
} from '../repositories/analytics.repository';
import type { Project } from '../types/project';

export interface ProjectDailyStatsPoint {
  date: string;
  views: number | null;
  uniqueVisitors: number | null;
  coverage: 'complete' | 'partial' | 'missing';
}

export interface ProjectStats {
  slug: string;
  range: '7d' | '30d';
  from: string;
  to: string;
  pageViews: number | null;
  uniqueVisitors: number | null;
  unidentifiedViews: number;
  lastViewAt?: string;
  coverage: { status: 'complete' | 'partial' | 'unavailable'; startedAt: string | null; timezone: 'UTC' };
  points: ProjectDailyStatsPoint[];
}

class AnalyticsService {
  async recordPageView(
    db: D1Database,
    slug: string,
    timestamp: Date,
    signal: PageViewSignal,
  ): Promise<boolean> {
    return analyticsRepository.recordPageView(db, slug, timestamp, signal);
  }

  async getProjectStatsForSlug(
    db: D1Database,
    slug: string,
    rangeDays: number,
  ): Promise<ProjectStats> {
    const now = new Date();
    const to = now.toISOString().slice(0,10);
    const from = new Date(`${to}T00:00:00.000Z`);
    from.setUTCDate(from.getUTCDate() - rangeDays + 1);
    const fromDate = from.toISOString().slice(0,10);
    const startedAt = await analyticsRepository.getCollectionStart(db);
    const available = !!startedAt && startedAt <= now.toISOString();
    const effectiveStart = startedAt && startedAt > from.toISOString() ? startedAt : from.toISOString();
    const rows = available ? await analyticsRepository.getBrowserStats(db,slug,effectiveStart,now.toISOString()) : null;
    const daily = new Map(rows?.daily.map(row => [row.date,row]));
    const points: ProjectDailyStatsPoint[] = [];
    for (let i=0;i<rangeDays;i+=1) {
      const date = new Date(from.getTime() + i * 86400000).toISOString().slice(0,10);
      const coverage = !available || date < startedAt!.slice(0,10) ? 'missing'
        : date === startedAt!.slice(0,10) && startedAt!.slice(11,23) !== '00:00:00.000' ? 'partial' : 'complete';
      const row = daily.get(date);
      points.push({ date, views: coverage === 'missing' ? null : row?.views ?? 0,
        uniqueVisitors: coverage === 'missing' ? null : row?.unique_visitors ?? 0, coverage });
    }
    return {
      slug,range: rangeDays === 30 ? '30d' : '7d',from: fromDate,to,
      pageViews: rows?.summary.views ?? null,uniqueVisitors: rows?.summary.unique_visitors ?? null,
      unidentifiedViews: rows?.summary.unidentified_views ?? 0,lastViewAt: rows?.summary.last_view_at ?? undefined,
      coverage: { status: !available ? 'unavailable' : points.some(point => point.coverage !== 'complete') ? 'partial' : 'complete',
        startedAt,timezone: 'UTC' },points,
    };
  }

  async getProjectStats(
    db: D1Database,
    project: Project,
    rangeDays: number,
  ): Promise<ProjectStats> {
    const slug = this.resolveSlugForProject(project);
    return this.getProjectStatsForSlug(db, slug, rangeDays);
  }

  async getViewsByProjectSlug(
    db: D1Database,
    projects: Project[],
    rangeDays: number,
  ): Promise<Record<string, number>> {
    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - rangeDays + 1);
    const fromDateStr = from.toISOString().slice(0, 10);
    const slugs = projects.map((project) => this.resolveSlugForProject(project));

    return analyticsRepository.getViewsBySlugSince(db, slugs, fromDateStr);
  }

  async deleteStatsForSlug(
    db: D1Database,
    slug: string,
  ): Promise<void> {
    await analyticsRepository.deleteStatsForSlug(db, slug);
  }

  /**
   * Resolve the analytics slug for a project.
   *
   * Primary source is the explicit `project.slug` field. For legacy rows
   * where this might be missing, fall back to parsing the subdomain from
   * the deployed public URL (e.g. https://slug.gemigo.app/). As a final
   * fallback, use the project ID so we always have a stable key.
   */
  private resolveSlugForProject(project: Project): string {
    const explicit = (project.slug ?? '').trim();
    if (explicit) return explicit;

    if (project.url) {
      try {
        const url = new URL(project.url);
        const host = url.hostname;
        const parts = host.split('.');
        if (parts.length >= 3) {
          // Handles patterns like slug.gemigo.app
          const subdomain = parts[0].trim();
          if (subdomain) return subdomain;
        }
      } catch {
        // Ignore invalid URLs and fall back to project.id below.
      }
    }

    return project.id;
  }
}

export const analyticsService = new AnalyticsService();
