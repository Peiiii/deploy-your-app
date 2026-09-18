import { metadataService } from '../services/metadata.service';
import type { ApiWorkerEnv } from '../types/env';
import { SourceType } from '../types/project';
import { ValidationError } from '../utils/error-handler';
import { jsonResponse, readJson } from '../utils/http';

class AnalysisController {
  analyzeSource = async (
    request: Request,
    env: ApiWorkerEnv,
  ): Promise<Response> => {
    const body = await readJson(request);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const identifier =
      typeof body.repoUrl === 'string' ? body.repoUrl.trim() : '';
    if (!name || !identifier) {
      throw new ValidationError('project.name and project.repoUrl are required');
    }

    const sourceType =
      body.sourceType === SourceType.Zip || body.sourceType === SourceType.Html
        ? body.sourceType
        : SourceType.GitHub;
    const htmlContent =
      typeof body.htmlContent === 'string' ? body.htmlContent : undefined;
    const slugSeed =
      typeof body.slug === 'string' && body.slug.trim()
        ? body.slug.trim()
        : undefined;

    const metadata = await metadataService.ensureProjectMetadata(env, {
      seedName: name,
      identifier,
      sourceType,
      htmlContent,
      slugSeed,
    });

    return jsonResponse({ metadata });
  };
}

export const analysisController = new AnalysisController();
