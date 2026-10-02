import type { ApiWorkerEnv } from '../types/env';
import type { Project } from '../types/project';
import { projectRepository } from '../repositories/project.repository';
import { aiService } from './ai.service';

class ProjectLanguageService {
  async scanProject(env: ApiWorkerEnv, db: D1Database, project: Project): Promise<void> {
    if (
      !project.url ||
      !project.lastSuccessAt ||
      project.status !== 'Live' ||
      project.isPublic === false ||
      project.isDeleted ||
      project.appLanguage?.source === 'author'
    )
      return;
    let languages: string[] = [];
    try {
      const url = new URL(project.url);
      const root = env.APPS_ROOT_DOMAIN || 'gemigo.app';
      if (
        url.protocol !== 'https:' ||
        !url.hostname.endsWith(`.${root}`) ||
        url.port ||
        url.username ||
        url.password
      )
        throw new Error('unsupported app URL');
      const response = await env.APP_CONTENT.fetch('https://app-content.internal/content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemigo-content-token': env.APP_CONTENT_TOKEN,
        },
        body: JSON.stringify({ url: project.url }),
        signal: AbortSignal.timeout(20000),
      });
      if (response.ok) {
        const data = (await response.json()) as {
          text?: string;
          controls?: string;
          htmlLang?: string;
        };
        languages = await aiService.detectAppLanguage(env, {
          text: typeof data.text === 'string' ? data.text.slice(0, 6000) : '',
          controls: typeof data.controls === 'string' ? data.controls.slice(0, 2000) : '',
          htmlLang: typeof data.htmlLang === 'string' ? data.htmlLang.slice(0, 32) : '',
        });
      }
    } catch {
      /* Persist an honest unknown once per release; a new release is retried. */
    }
    await projectRepository.saveDetectedLanguage(db, project, {
      languages,
      source: 'detected',
      revision: project.lastSuccessAt,
      checkedAt: new Date().toISOString(),
    });
  }

  async scanPending(env: ApiWorkerEnv, db: D1Database): Promise<void> {
    if (!db || !env.APP_CONTENT || !env.APP_CONTENT_TOKEN || !aiService.isEnabled(env)) return;
    for (const project of await projectRepository.languageScanCandidates(db)) {
      await this.scanProject(env, db, project);
    }
  }
}

export const projectLanguageService = new ProjectLanguageService();
