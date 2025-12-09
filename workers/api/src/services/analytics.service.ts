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
    const slug = this.resolveSlugForProject(project);
    return this.getProjectStatsForSlug(db, slug, rangeDays);
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
