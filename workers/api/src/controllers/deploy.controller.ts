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
  private projectNeedsMetadata(project: Project): boolean {
    return (
      !project.slug ||
      !project.description ||
      !project.category ||
      !project.tags ||
      project.tags.length === 0 ||
      !project.name
    );
  }

  private buildMetadataPatch(
    current: Project,
    meta: {
      name?: string;
      slug?: string;
      description?: string;
      category?: string;
      tags?: string[];
    },
  ): {
    name?: string;
    slug?: string;
    description?: string;
    category?: string;
    tags?: string[];
  } {
    const patch: {
      name?: string;
      slug?: string;
      description?: string;
      category?: string;
      tags?: string[];
    } = {};

    if (!current.slug && meta.slug) {
      patch.slug = meta.slug;
    }
    if (!current.name && meta.name) {
      patch.name = meta.name;
    }
    if (!current.description && meta.description) {
      patch.description = meta.description;
    }
    if (!current.category && meta.category) {
      patch.category = meta.category;
    }
    if ((!current.tags || current.tags.length === 0) && meta.tags) {
      patch.tags = meta.tags;
    }

    return patch;
  }

  private async applyMetadataPatch(
    db: D1Database,
    projectId: string,
    patch: {
      name?: string;
      slug?: string;
      description?: string;
      category?: string;
      tags?: string[];
    },
  ): Promise<void> {
    if (Object.keys(patch).length === 0) return;
    await projectService.updateProject(db, projectId, patch);
  }

  private parseProjectId(body: unknown): string {
    const rawBody = body as Record<string, unknown>;
    const rawProjectId =
      typeof rawBody?.id === 'string'
        ? rawBody.id
        : typeof rawBody?.projectId === 'string'
          ? rawBody.projectId
          : null;
    const projectId = rawProjectId?.trim() ?? '';
    if (!projectId) {
      throw new ValidationError(
        'project.id is required. Create a project before deploying.',
      );
    }
    return projectId;
  }

  private resolveSourceType(
    body: Record<string, unknown>,
    project: Project,
  ): SourceType {
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
    return finalSourceType;
  }

  private validateSourceInputs(
    finalSourceType: SourceType,
    project: Project,
    zipData?: string,
    htmlContent?: string,
  ): void {
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
  }

  private buildDeployProject(
    project: Project,
    finalSourceType: SourceType,
    analysisId: string | undefined,
    htmlContent?: string,
  ): Project {
    return {
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
      deployTarget: project.deployTarget,
      ...(project.providerUrl ? { providerUrl: project.providerUrl } : {}),
      ...(project.cloudflareProjectName
        ? { cloudflareProjectName: project.cloudflareProjectName }
        : {}),
      ...(finalSourceType === SourceType.Html && htmlContent
        ? { htmlContent }
        : {}),
    };
  }

  private async parseDeploymentId(response: Response): Promise<string | undefined> {
    try {
      const parsed = (await response.clone().json().catch(() => ({}))) as {
        deploymentId?: string;
      };
      return parsed.deploymentId;
    } catch {
      return undefined;
    }
  }

  private async enrichProjectFromAnalysis(
    env: ApiWorkerEnv,
    request: Request,
    project: Project,
    finalSourceType: SourceType,
    htmlContent: string | undefined,
    analysisIdFromClient: string | undefined,
  ): Promise<{ project: Project; analysisId?: string }> {
    let analysisId = analysisIdFromClient;

    try {
      const analysisInput = {
        ...project,
        sourceType: finalSourceType,
        ...(htmlContent ? { htmlContent } : {}),
      };
      const analysis = await this.runAnalysis(env, request, analysisInput);

      analysisId = analysis.analysisId ?? analysisIdFromClient;

      if (analysis.metadata && typeof analysis.metadata === 'object') {
        const meta = analysis.metadata as {
          name?: string;
          slug?: string;
          description?: string;
          category?: string;
          tags?: string[];
        };

        const patch = this.buildMetadataPatch(project, meta);
        project = {
          ...project,
          ...patch,
        };
      }
    } catch (analysisErr) {
      console.error('Analysis failed, continuing without enriched metadata', analysisErr);
    }

    return { project, analysisId };
  }

  private extractSseEvents(buffer: string): { events: string[]; rest: string } {
    const events: string[] = [];
    let rest = buffer;
    let splitIndex: number;
    while ((splitIndex = rest.indexOf('\n\n')) !== -1) {
      const chunk = rest.slice(0, splitIndex);
      rest = rest.slice(splitIndex + 2);
      const line = chunk
        .split('\n')
        .find((l) => l.trim().startsWith('data:'));
      if (!line) continue;
      events.push(line.replace(/^data:\s*/, ''));
    }
    return { events, rest };
  }

  private async handleStatusPayload(
    db: D1Database,
    projectId: string,
    payload: {
      type?: string;
      status?: string;
      projectMetadata?: {
        name?: string;
        slug?: string;
        description?: string;
        category?: string;
        tags?: string[];
        url?: string;
      };
    },
  ): Promise<boolean> {
    if (payload.type !== 'status') return false;

    const current = await projectService.getProjectById(db, projectId);
    if (!current) return false;

    if (payload.status === 'SUCCESS') {
      const meta = payload.projectMetadata ?? {};
      const patchProject = this.buildMetadataPatch(current, meta);

      if (Object.keys(patchProject).length > 0) {
        await this.applyMetadataPatch(db, projectId, patchProject);
      }

      await projectService.updateProjectDeployment(db, projectId, {
        status: 'Live',
        lastDeployed: new Date().toISOString(),
        ...(meta.url ? { url: meta.url } : {}),
      });
      return true;
    }

    if (payload.status === 'FAILED') {
      await projectService.updateProjectDeployment(db, projectId, {
        status: 'Failed',
        lastDeployed: new Date().toISOString(),
      });
      return true;
    }

    return false;
  }

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

  private async runAnalysis(
    env: ApiWorkerEnv,
    request: Request,
    body: unknown,
  ): Promise<{ metadata?: Record<string, unknown>; analysisId?: string }> {
    const baseUrl = configService.getDeployServiceBaseUrl(env);
    const targetUrl = `${baseUrl}/analyze`;
    const headers = this.sanitizeForwardHeaders(request.headers);
    headers.set('Content-Type', 'application/json');

    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      throw new Error(
        text || `Analysis request failed with status ${upstream.status}`,
      );
    }

    const data = (await upstream.json().catch(() => ({}))) as {
      metadata?: Record<string, unknown>;
      analysisId?: string;
    };

    return data;
  }

  private async monitorDeployment(
    env: ApiWorkerEnv,
    db: D1Database,
    deploymentId: string,
    projectId: string,
  ): Promise<void> {
    try {
      const baseUrl = configService.getDeployServiceBaseUrl(env);
      const targetUrl = `${baseUrl}/deployments/${encodeURIComponent(deploymentId)}/stream`;
      const upstream = await fetch(targetUrl, {
        method: 'GET',
        headers: this.sanitizeForwardHeaders(new Headers()),
      });
      const reader = upstream.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value);
        const { events, rest } = this.extractSseEvents(buffer);
        buffer = rest;
        for (const payloadStr of events) {
          let payload: {
            type?: string;
            status?: string;
            projectMetadata?: {
              name?: string;
              slug?: string;
              description?: string;
              category?: string;
              tags?: string[];
              url?: string;
            };
          };
          try {
            payload = JSON.parse(payloadStr);
          } catch {
            continue;
          }
          const handled = await this.handleStatusPayload(db, projectId, payload);
          if (handled) {
            return;
          }
        }
      }
    } catch (err) {
      console.error('Deployment monitor failed', err);
    }
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
    const projectId = this.parseProjectId(body);

    let project = await projectService.getProjectById(db, projectId);
    if (!project) {
      throw new NotFoundError('Project not found');
    }
    if (!project.ownerId || project.ownerId !== sessionWithUser.user.id) {
      throw new UnauthorizedError('Only the project owner can deploy it.');
    }

    // Deploy target is an environment-level infrastructure choice (local/r2/cloudflare).
    // Prefer the current Worker env config so changing DEPLOY_TARGET takes effect
    // immediately without requiring updating existing project records.
    const effectiveDeployTarget = configService.getDeployTarget(env);
    const finalSourceType = this.resolveSourceType(body as Record<string, unknown>, project);

    const zipData = typeof body.zipData === 'string' ? body.zipData : undefined;
    const htmlContent =
      typeof body.htmlContent === 'string'
        ? body.htmlContent
        : project.htmlContent;
    const analysisIdFromClient =
      typeof body.analysisId === 'string' ? body.analysisId : undefined;

    this.validateSourceInputs(finalSourceType, project, zipData, htmlContent);

    // For draft projects with empty slug, require metadata/analysis to supply a slug.
    let analysisId: string | undefined = analysisIdFromClient;
    if (!project.slug) {
      const result = await this.enrichProjectFromAnalysis(
        env,
        request,
        project,
        finalSourceType,
        htmlContent,
        analysisIdFromClient,
      );
      project = result.project;
      analysisId = result.analysisId;

      // Persist newly derived metadata (e.g. slug) before starting the deploy
      // so the project record stays in sync even if the deploy fails later.
      const preDeployPatch = this.buildMetadataPatch(project, {
        name: project.name,
        slug: project.slug,
        description: project.description,
        category: project.category,
        tags: project.tags,
      });
      await this.applyMetadataPatch(db, project.id, preDeployPatch);
    }

    if (!project.slug || project.slug.trim().length === 0) {
      throw new ValidationError(
        'Slug is required for deployment but could not be derived from analysis. Please set a slug and retry.',
      );
    }

    const nodeProject: Project = {
      ...this.buildDeployProject(project, finalSourceType, analysisId, htmlContent),
      deployTarget: effectiveDeployTarget,
    };

    const forwardBody =
      finalSourceType === SourceType.Zip && zipData
        ? { ...nodeProject, zipData }
        : nodeProject;

    const response = await this.proxyDeployJson(env, request, '/deploy', forwardBody);
    const deploymentId = await this.parseDeploymentId(response);
    if (deploymentId) {
      // Fire-and-forget monitor to persist metadata/status after deploy completes.
      void this.monitorDeployment(env, db, deploymentId, project.id);
    }
    return response;
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
