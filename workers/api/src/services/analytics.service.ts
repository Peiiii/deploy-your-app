import { analyticsRepository } from '../repositories/analytics.repository';
import type { Project } from '../types/project';

export interface ProjectDailyStatsPoint {
  date: string;
  views: number;
}

export interface ProjectStats {
  slug: string;
  totalViews: number;
  views7d: number;
  lastViewAt?: string;
  points: ProjectDailyStatsPoint[];
}

class AnalyticsService {
  async recordPageView(
    db: D1Database,
    slug: string,
    timestamp: Date,
  ): Promise<void> {
    const date = timestamp.toISOString().slice(0, 10); // YYYY-MM-DD
    await analyticsRepository.incrementPageView(
      db,
      slug,
      date,
      timestamp.toISOString(),
    );
  }

  async getProjectStatsForSlug(
    db: D1Database,
    slug: string,
    rangeDays: number,
  ): Promise<ProjectStats> {
    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - rangeDays + 1);
    const fromDateStr = from.toISOString().slice(0, 10);

    const rows = await analyticsRepository.getStatsForSlug(
      db,
      slug,
      fromDateStr,
    );

    let totalViews = 0;
    let lastViewAt: string | undefined;

    const points: ProjectDailyStatsPoint[] = rows.map((row) => {
      totalViews += row.views;
      if (row.last_view_at) {
        if (!lastViewAt || row.last_view_at > lastViewAt) {
          lastViewAt = row.last_view_at;
        }
      }
      return {
        date: row.date,
        views: row.views,
      };
    });

    return {
      slug,
      totalViews,
      views7d: totalViews,
      lastViewAt,
      points,
    };
  }

  async getProjectStats(
    db: D1Database,
    project: Project,
    rangeDays: number,
  ): Promise<ProjectStats> {
    const slug =
      typeof project.slug === 'string' && project.slug.trim().length > 0
        ? project.slug
        : project.id;
    return this.getProjectStatsForSlug(db, slug, rangeDays);
  }
}

export const analyticsService = new AnalyticsService();

