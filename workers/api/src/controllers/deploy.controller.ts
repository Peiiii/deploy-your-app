import type { ApiWorkerEnv } from '../types/env';
import { deploymentSourceService } from '../services/deployment-source.service';
import { readJson, jsonResponse } from '../utils/http';
import { configService } from '../services/config.service';
import { NotFoundError, UnauthorizedError, ValidationError } from '../utils/error-handler';
import { getSessionIdFromRequest } from '../utils/auth';
import { authRepository } from '../repositories/auth.repository';
import { projectService } from '../services/project.service';
import { deployService } from '../services/deploy.service';
import { deployProxyService } from '../services/deploy-proxy.service';
import { deploymentRepository } from '../repositories/deployment.repository';

/**
 * DeployController - Handles HTTP requests for deployment operations.
 * 
 * This controller is intentionally thin. Business logic lives in:
 * - deployService: validation, enrichment, monitoring
 * - deployProxyService: communication with Node.js deploy server
 */
class DeployController {
  /**
   * POST /api/v1/deploy
   * Start a new deployment for an existing project.
   */
  async startDeployment(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
  ): Promise<Response> {
    // 1. Authenticate
    const user = await this.requireAuth(request, db);

    // Reject old Base64 requests before allocating a large JSON body in the Worker.
    if (Number(request.headers.get('content-length')) > 10 * 1024 * 1024) throw new ValidationError('This ZIP request is too large. Use the website file upload or the latest GemiGo CLI.');

    // 2. Parse request
    const body = await readJson(request);
    const input = deployService.parseDeployInput(body);

    // 3. Load and validate project ownership
    const project = await projectService.getProjectById(db, input.projectId);
    if (!project) {
      throw new NotFoundError('Project not found');
    }
    if (project.ownerId !== user.id) {
      throw new UnauthorizedError('Only the project owner can deploy.');
    }

    if (input.flowId) {
      const existing = await deploymentRepository.findByFlow(db, input.flowId);
      if (existing) {
        if (existing.project_id !== project.id || existing.owner_id !== user.id) throw new UnauthorizedError('Deployment flow belongs to another project.');
        if (existing.provider_deployment_id) return jsonResponse({ deploymentId: existing.provider_deployment_id });
        return jsonResponse({ error: 'This deployment request is already recorded. Please start a new attempt.' }, 409);
      }
    }
    const uploadedBytes = input.zipSourceKey ? await deploymentSourceService.validate(env, project.id, input.zipSourceKey) : undefined;
    if (input.zipData && input.zipData.length > 9 * 1024 * 1024) {
      throw new ValidationError('For ZIP files larger than 6.75 MB, use the website file upload or the latest GemiGo CLI.');
    }

    // 4. Resolve source type and validate inputs
    const sourceType = deployService.resolveSourceType(input, project);
    const htmlContent = input.htmlContent || project.htmlContent;
    deployService.validateSourceInputs(sourceType, project, { ...input, htmlContent });

    // 5. Fill missing discovery metadata via source analysis and AI.
    const enrichResult = await deployService.enrichProjectMetadata(
      env,
      db,
      request,
      project,
      sourceType,
      input,
    );
    const enrichedProject = enrichResult.project;
    const analysisId = enrichResult.analysisId;

    // 6. Validate slug exists
    if (!enrichedProject.slug?.trim()) {
      throw new ValidationError(
        'Slug is required but could not be derived. Please set a slug manually.',
      );
    }

    // 7. Build payload and deploy
    const deployTarget = configService.getDeployTarget(env);
    const payload = deployService.buildDeployPayload(
      enrichedProject,
      sourceType,
      analysisId,
      htmlContent,
      deployTarget,
    );

    const attemptId = crypto.randomUUID();
    const startedAtMs = Date.now();
    const startedAt = new Date(startedAtMs).toISOString();
    await deploymentRepository.createAttempt(db, {
      id: attemptId,
      projectId: project.id,
      ownerId: user.id,
      flowId: input.flowId,
      sourceType,
      clientChannel: input.clientChannel,
      fileExtension: this.getFileExtension(input.sourceFilename),
      payloadBytes: uploadedBytes ?? (input.zipData
        ? Math.floor((input.zipData.length * 3) / 4)
        : htmlContent
          ? new TextEncoder().encode(htmlContent).byteLength
          : undefined),
      startedAt,
    });
    await projectService.updateProject(db, project.id, { sourceType });
    await projectService.updateProjectDeployment(db, project.id, {
      status: 'Building',
      sourceType,
    }, attemptId);

    let response: Response;
    try {
      let zipSourceKey = input.zipSourceKey;
      if (input.zipData && env.ASSETS) {
        const bytes = Uint8Array.from(atob(input.zipData), character => character.charCodeAt(0));
        zipSourceKey = `deployment-sources/${new Date().toISOString().slice(0, 10)}/${project.id}/${crypto.randomUUID()}.zip`;
        await env.ASSETS.put(zipSourceKey, bytes, { customMetadata: { projectId: project.id }, httpMetadata: { contentType: 'application/zip' } });
      }
      const forwardBody = zipSourceKey ? { ...payload, zipSourceKey } : input.zipData ? { ...payload, zipData: input.zipData } : payload;
      response = await deployProxyService.proxyJson(env, request, '/deploy', forwardBody);
    } catch (error) {
      await deploymentRepository.finishAttempt(
        db,
        attemptId,
        'rejected',
        new Date().toISOString(),
        Date.now() - startedAtMs,
        'upstream_unreachable',
      );
      await projectService.updateProjectDeployment(db, project.id, {
        status: 'Failed',
      }, attemptId);
      throw error;
    }

    // 8. Start background monitoring and inject enrichment logs
    const deploymentId = await deployProxyService.parseDeploymentId(response);
    if (deploymentId) {
      await deploymentRepository.markAccepted(
        db,
        attemptId,
        deploymentId,
        new Date().toISOString(),
      );
      // Inject enrichment debug logs (will be queued if stream not yet created)
      if (enrichResult.debugLogs.length > 0) {
        const logHeader = '═══ Project Enrichment Debug ═══';
        deployProxyService.injectLog(deploymentId, logHeader, 'info');

        enrichResult.debugLogs.forEach(log => {
          deployProxyService.injectLog(deploymentId, log, 'info');
        });

        deployProxyService.injectLog(deploymentId, '═══════════════════════════════', 'info');
      }

    } else {
      await deploymentRepository.finishAttempt(
        db,
        attemptId,
        'rejected',
        new Date().toISOString(),
        Date.now() - startedAtMs,
        `upstream_${response.status}`,
      );
      await projectService.updateProjectDeployment(db, project.id, {
        status: 'Failed',
      }, attemptId);
    }

    return response;
  }

  async latestResult(request: Request, _env: ApiWorkerEnv, db: D1Database, projectId: string): Promise<Response> {
    const user = await this.requireAuth(request, db);
    const project = await projectService.getProjectById(db, projectId);
    if (!project || project.ownerId !== user.id) throw new UnauthorizedError('Only the project owner can read deployment results.');
    const attempt = await deploymentRepository.latestForProject(db, projectId);
    return jsonResponse(attempt ? {
      status: attempt.status, stage: attempt.stage, buildMode: attempt.build_mode,
      errorCode: attempt.error_code, errorMessage: attempt.error_message,
      startedAt: attempt.started_at, finishedAt: attempt.finished_at,
    } : null);
  }

  async uploadSource(request: Request, env: ApiWorkerEnv, db: D1Database, projectId: string): Promise<Response> {
    const user = await this.requireAuth(request, db);
    const project = await projectService.getProjectById(db, projectId);
    if (!project || project.ownerId !== user.id) throw new UnauthorizedError('Only the project owner can upload deployment sources.');
    return jsonResponse(await deploymentSourceService.upload(env, projectId, request));
  }

  async reconcile(request: Request, env: ApiWorkerEnv, db: D1Database, id: string): Promise<Response> {
    await this.requireDeploymentOwner(request, db, id);
    return jsonResponse(await deployService.reconcileDeployment(env, db, id));
  }

  private async requireDeploymentOwner(request: Request, db: D1Database, id: string): Promise<void> {
    const user = await this.requireAuth(request, db);
    const attempt = await deploymentRepository.findByProviderId(db, id);
    if (!attempt) throw new NotFoundError('Deployment not found.');
    const project = await projectService.getProjectById(db, attempt.project_id);
    if (!project || project.ownerId !== user.id) throw new UnauthorizedError('Only the project owner can read deployment results.');
  }

  private getFileExtension = (filename?: string): string | undefined => {
    if (!filename) return undefined;
    const match = filename.toLowerCase().match(/\.([a-z0-9]{1,10})$/);
    return match?.[1];
  };

  /**
   * POST /api/v1/analyze
   * Analyze source code to generate project metadata.
   */
  async analyzeSource(request: Request, env: ApiWorkerEnv): Promise<Response> {
    return deployProxyService.proxyRequest(env, request, '/analyze');
  }

  /**
   * GET /api/v1/deployments/:id/stream
   * Stream deployment logs via SSE.
   */
  async streamDeployment(
    request: Request,
    env: ApiWorkerEnv,
    id: string,
    db: D1Database,
  ): Promise<Response> {
    await this.requireDeploymentOwner(request, db, id);
    // Use merged stream instead of simple proxy
    // This allows Worker to inject its own logs
    const handle = await deployService.statusHandler(env, db, id);
    const { response } = await deployProxyService.createMergedStream(env, id, handle);
    return response;
  }

  // ─────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────

  private async requireAuth(request: Request, db: D1Database) {
    const sessionId = getSessionIdFromRequest(request);
    if (!sessionId) {
      throw new UnauthorizedError('Login required to deploy.');
    }
    const session = await authRepository.getSessionWithUser(db, sessionId);
    if (!session) {
      throw new UnauthorizedError('Invalid session.');
    }
    return session.user;
  }
}

export const deployController = new DeployController();
