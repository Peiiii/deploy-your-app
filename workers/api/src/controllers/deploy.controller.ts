import type { ApiWorkerEnv } from '../types/env';
import { CORS_HEADERS, readJson } from '../utils/http';
import { configService } from '../services/config.service';
import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../utils/error-handler';
import { getSessionIdFromRequest } from '../utils/auth';
import { authRepository } from '../repositories/auth.repository';
import { projectService } from '../services/project.service';
import { SourceType, type Project } from '../types/project';

class DeployController {
  private sanitizeForwardHeaders(source: Headers): Headers {
    const headers = new Headers();
    source.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (
        lower === 'host' ||
        lower.startsWith('cf-') ||
        lower === 'content-length'
      ) {
        return;
      }
      headers.set(key, value);
    });
    return headers;
  }

  private withCorsResponse(
    response: Response,
    extra?: Record<string, string>,
  ): Response {
    const headers = new Headers(response.headers);
    Object.entries(CORS_HEADERS).forEach(([key, value]) =>
      headers.set(key, value),
    );
    if (extra) {
      Object.entries(extra).forEach(([key, value]) =>
        headers.set(key, value),
      );
    }
    return new Response(response.body, {
      status: response.status,
      headers,
    });
  }

  private async proxyDeployRequest(
    env: ApiWorkerEnv,
    request: Request,
    subPath: string,
  ): Promise<Response> {
    const baseUrl = configService.getDeployServiceBaseUrl(env);
    const targetUrl = `${baseUrl}${subPath}`;
    const fetchOptions: RequestInit = {
      method: request.method,
      headers: this.sanitizeForwardHeaders(request.headers),
    };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      fetchOptions.body = request.body;
    }
    const upstream = await fetch(targetUrl, fetchOptions);
    return this.withCorsResponse(upstream);
  }

  private async proxyDeployJson(
    env: ApiWorkerEnv,
    request: Request,
    subPath: string,
    body: unknown,
  ): Promise<Response> {
    const baseUrl = configService.getDeployServiceBaseUrl(env);
    const targetUrl = `${baseUrl}${subPath}`;
    const headers = this.sanitizeForwardHeaders(request.headers);
    headers.set('Content-Type', 'application/json');
    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: JSON.stringify(body),
    });
    return this.withCorsResponse(upstream);
  }

  private async proxyDeployStream(
    env: ApiWorkerEnv,
    request: Request,
    deploymentId: string,
  ): Promise<Response> {
    const baseUrl = configService.getDeployServiceBaseUrl(env);
    const targetUrl = `${baseUrl}/deployments/${encodeURIComponent(
      deploymentId,
    )}/stream`;
    const upstream = await fetch(targetUrl, {
      method: 'GET',
      headers: this.sanitizeForwardHeaders(request.headers),
    });

    const contentType = upstream.headers.get('content-type') ?? '';
    const isEventStream = contentType.includes('text/event-stream');
    return this.withCorsResponse(
      upstream,
      isEventStream
        ? {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          }
        : undefined,
    );
  }

  // POST /api/v1/deploy
  async startDeployment(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
  ): Promise<Response> {
    const sessionId = getSessionIdFromRequest(request);
    if (!sessionId) {
      throw new UnauthorizedError('Login required to deploy a project.');
    }
    const sessionWithUser = await authRepository.getSessionWithUser(
      db,
      sessionId,
    );
    if (!sessionWithUser) {
      throw new UnauthorizedError('Login required to deploy a project.');
    }

    const body = await readJson(request);
    const rawProjectId =
      typeof body.id === 'string'
        ? body.id
        : typeof body.projectId === 'string'
          ? body.projectId
          : null;
    const projectId = rawProjectId?.trim() ?? '';
    if (!projectId) {
      throw new ValidationError(
        'project.id is required. Create a project before deploying.',
      );
    }

    const project = await projectService.getProjectById(db, projectId);
    if (!project) {
      throw new NotFoundError('Project not found');
    }
    if (!project.ownerId || project.ownerId !== sessionWithUser.user.id) {
      throw new UnauthorizedError('Only the project owner can deploy it.');
    }

    if (!project.slug || project.slug.trim().length === 0) {
      throw new ValidationError(
        'Project slug is missing. Create the project again or contact support.',
      );
    }

    // Deploy target is an environment-level infrastructure choice (local/r2/cloudflare).
    // Prefer the current Worker env config so changing DEPLOY_TARGET takes effect
    // immediately without requiring updating existing project records.
    const effectiveDeployTarget = configService.getDeployTarget(env);

    const sourceType =
      typeof body.sourceType === 'string' ? body.sourceType : undefined;
    const requestedSourceType = Object.values(SourceType).includes(
      sourceType as SourceType,
    )
      ? (sourceType as SourceType)
      : undefined;
    const finalSourceType = requestedSourceType ?? project.sourceType;
    if (!finalSourceType) {
      throw new ValidationError(
        'sourceType is required when deploying a project.',
      );
    }

    const zipData = typeof body.zipData === 'string' ? body.zipData : undefined;
    const htmlContent =
      typeof body.htmlContent === 'string'
        ? body.htmlContent
        : project.htmlContent;
    const analysisId =
      typeof body.analysisId === 'string' ? body.analysisId : undefined;

    if (finalSourceType === SourceType.Zip) {
      if (!zipData || zipData.trim().length === 0) {
        throw new ValidationError(
          'zipData is required for ZIP deployments. Upload a .zip file to deploy.',
        );
      }
    }

    if (finalSourceType === SourceType.Html) {
      if (!htmlContent || htmlContent.trim().length === 0) {
        throw new ValidationError(
          'htmlContent is required for HTML deployments. Provide inline HTML before deploying.',
        );
      }
    }

    if (finalSourceType === SourceType.GitHub) {
      if (!project.repoUrl || project.repoUrl.trim().length === 0) {
        throw new ValidationError(
          'repoUrl is required for GitHub deployments. Set the repository URL on the project first.',
        );
      }
      if (project.repoUrl.startsWith('draft:')) {
        throw new ValidationError(
          'repoUrl is not configured. Set the repository URL on the project first.',
        );
      }
    }

    const nodeProject: Project = {
      id: project.id,
      name: project.name,
      repoUrl: project.repoUrl,
      sourceType: finalSourceType,
      slug: project.slug,
      ...(analysisId ? { analysisId } : {}),
      lastDeployed: project.lastDeployed,
      status: project.status,
      ...(project.url ? { url: project.url } : {}),
      ...(project.description ? { description: project.description } : {}),
      framework: project.framework,
      ...(project.category ? { category: project.category } : {}),
      ...(project.tags ? { tags: project.tags } : {}),
      deployTarget: effectiveDeployTarget,
      ...(project.providerUrl ? { providerUrl: project.providerUrl } : {}),
      ...(project.cloudflareProjectName
        ? { cloudflareProjectName: project.cloudflareProjectName }
        : {}),
      ...(finalSourceType === SourceType.Html && htmlContent
        ? { htmlContent }
        : {}),
    };

    const forwardBody =
      finalSourceType === SourceType.Zip && zipData
        ? { ...nodeProject, zipData }
        : nodeProject;

    return this.proxyDeployJson(env, request, '/deploy', forwardBody);
  }

  // POST /api/v1/analyze
  async analyzeSource(
    request: Request,
    env: ApiWorkerEnv,
  ): Promise<Response> {
    return this.proxyDeployRequest(env, request, '/analyze');
  }

  // GET /api/v1/deployments/:id/stream
  async streamDeployment(
    request: Request,
    env: ApiWorkerEnv,
    id: string,
  ): Promise<Response> {
    return this.proxyDeployStream(env, request, id);
  }
}

export const deployController = new DeployController();
