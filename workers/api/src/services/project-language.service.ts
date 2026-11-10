import type { ApiWorkerEnv } from '../types/env';
import type { Project } from '../types/project';
import { projectRepository } from '../repositories/project.repository';
import { detectStaticAppLanguages, readStaticHtml } from '../utils/static-app-language';

class ProjectLanguageService {
  async scanProject(
    env: ApiWorkerEnv,
    db: D1Database,
    project: Project
  ): Promise<{
    status: 'skipped' | 'detected' | 'unknown' | 'content_unavailable';
    contentStatus?: number;
    contentStage?: string;
    appStatus?: number;
    failureReason?: string;
  }> {
    if (
      !project.url ||
      !project.lastSuccessAt ||
      project.status !== 'Live' ||
      project.isPublic === false ||
      project.isDeleted ||
      project.appLanguage?.source === 'author'
    )
      return { status: 'skipped' };
    let languages: string[];
    try {
      const url = new URL(project.url);
      const root = env.APPS_ROOT_DOMAIN || 'gemigo.app';
      if (
        url.protocol !== 'https:' ||
        !url.hostname.endsWith(`.${root}`) ||
        url.port ||
        url.username ||
        url.password
      ) {
        await projectRepository.deferLanguageScan(db, project);
        return { status: 'skipped' };
      }
      const response = await fetch(project.url, {
        headers: { Accept: 'text/html' },
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        await projectRepository.deferLanguageScan(db, project);
        return {
          status: 'content_unavailable',
          contentStatus: response.status,
          contentStage: 'fetch',
        };
      }
      const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
        await projectRepository.deferLanguageScan(db, project);
        return {
          status: 'content_unavailable',
          contentStatus: response.status,
          contentStage: 'content-type',
        };
      }
      languages = detectStaticAppLanguages(await readStaticHtml(response));
    } catch (error) {
      console.warn(
        'App content request failed',
        error instanceof Error ? error.message.slice(0, 200) : 'Error'
      );
      await projectRepository.deferLanguageScan(db, project);
      return {
        status: 'content_unavailable',
        failureReason:
          error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'request_failed',
      };
    }
    await projectRepository.saveDetectedLanguage(db, project, {
      languages,
      source: 'detected',
      revision: project.lastSuccessAt,
      checkedAt: new Date().toISOString(),
    });
    return { status: languages.length ? 'detected' : 'unknown' };
  }

  async scanPending(env: ApiWorkerEnv, db: D1Database): Promise<void> {
    if (!db) return;
    for (const project of await projectRepository.languageScanCandidates(db)) {
      await this.scanProject(env, db, project);
    }
  }
}

export const projectLanguageService = new ProjectLanguageService();
