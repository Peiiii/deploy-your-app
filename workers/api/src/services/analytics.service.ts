import { analyticsRepository, type PageViewSignal } from '../repositories/analytics.repository';
import type { Project } from '../types/project';

import { queryAppTraffic, appTrafficSlug, type ProjectStats } from '@gemigo/product-analytics';
export type { ProjectDailyStatsPoint, ProjectStats } from '@gemigo/product-analytics';

class AnalyticsService {
  async recordPageView(
    db: D1Database,
    slug: string,
    timestamp: Date,
    signal: PageViewSignal
  ): Promise<boolean> {
    return analyticsRepository.recordPageView(db, slug, timestamp, signal);
  }

  async getProjectStatsForSlug(
    db: D1Database,
    slug: string,
    rangeDays: number
  ): Promise<ProjectStats> {
    return (await this.getStatsForSlugs(db, [slug], rangeDays))[slug];
  }

  async getProjectStatsForProjects(
    db: D1Database,
    projects: Project[],
    rangeDays: number
  ): Promise<Record<string, ProjectStats>> {
    if (!projects.length) return {};
    const stats = await this.getStatsForSlugs(
      db,
      projects.map((project) => appTrafficSlug(project)),
      rangeDays
    );
    return Object.fromEntries(
      projects.map((project) => [project.id, stats[appTrafficSlug(project)]])
    );
  }

  private async getStatsForSlugs(
    db: D1Database,
    slugs: string[],
    rangeDays: number
  ): Promise<Record<string, ProjectStats>> {
    await analyticsRepository.ensureSchema(db);
    return (await queryAppTraffic(db, slugs, rangeDays)).stats;
  }

  async getProjectStats(
    db: D1Database,
    project: Project,
    rangeDays: number
  ): Promise<ProjectStats> {
    const slug = appTrafficSlug(project);
    return this.getProjectStatsForSlug(db, slug, rangeDays);
  }

  async getViewsByProjectSlug(
    db: D1Database,
    projects: Project[],
    rangeDays: number
  ): Promise<Record<string, number>> {
    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - rangeDays + 1);
    const fromDateStr = from.toISOString().slice(0, 10);
    const slugs = projects.map((project) => appTrafficSlug(project));

    return analyticsRepository.getViewsBySlugSince(db, slugs, fromDateStr);
  }

  async deleteStatsForSlug(db: D1Database, slug: string): Promise<void> {
    await analyticsRepository.deleteStatsForSlug(db, slug);
  }
}

export const analyticsService = new AnalyticsService();
