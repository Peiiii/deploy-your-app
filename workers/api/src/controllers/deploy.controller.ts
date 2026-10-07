import type { ApiWorkerEnv } from '../types/env';
import { appGatewayController } from '../app-gateway/controller';
import { deploymentSourceService } from '../services/deployment-source.service';
import { readJson, jsonResponse } from '../utils/http';
import { staticPublication } from '../services/static-publication.service';
import { NotFoundError, UnauthorizedError, ValidationError, ConfigurationError } from '../utils/error-handler';
import { getSessionIdFromRequest } from '../utils/auth';
import { authRepository } from '../repositories/auth.repository';
import { projectService } from '../services/project.service';
import { deployService } from '../services/deploy.service';
import { deploymentRepository } from '../repositories/deployment.repository';

/**
 * DeployController - Handles HTTP requests for deployment operations.
 * 
 * This controller is intentionally thin. Business logic lives in:
 * - deployService: validation, enrichment, monitoring
 * - staticPublication: durable static asset publication
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
    serialized = false,
    storage?: DurableObjectStorage,
  ): Promise<Response> {
    // 1. Authenticate
    const user = await this.requireAuth(request, db);

    // Reject old Base64 requests before allocating a large JSON body in the Worker.
    if (Number(request.headers.get('content-length')) > 10 * 1024 * 1024) throw new ValidationError('This ZIP request is too large. Use the website file upload or the latest GemiGo CLI.');

    const forwarded = !serialized && env.APP_GATEWAY ? request.clone() as unknown as Request : undefined;
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

    if (forwarded) return appGatewayController.projectMutation(forwarded, env, project.id, user.id, 'deploy');

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

    if (!storage) throw new ConfigurationError('Deployment queue is unavailable.');

    const attemptId = crypto.randomUUID();
    const startedAtMs = Date.now();
    const startedAt = new Date(startedAtMs).toISOString();
    await deploymentRepository.createAttempt(db, {
      id: attemptId,
      providerDeploymentId: attemptId,
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
    await projectService.updateProject(db, project.id, { sourceType, ...(sourceType === 'html' && htmlContent ? { htmlContent } : {}) });
    await projectService.updateProjectDeployment(db, project.id, {
      status: 'Building',
      sourceType,
    }, attemptId);

    let dispatched = false;
    try {
      await staticPublication.enqueue(env, storage, project, { ...input, sourceType, htmlContent }, attemptId, startedAt);
      dispatched = true;
      await deploymentRepository.markAccepted(db, attemptId, attemptId, new Date().toISOString());
    } catch (error) {
      if (dispatched) return jsonResponse({ deploymentId: attemptId, recovering: true });
      await deploymentRepository.finishAttempt(db, attemptId, 'rejected', new Date().toISOString(), Date.now() - startedAtMs, 'queue_unavailable');
      await projectService.updateProjectDeployment(db, project.id, { status: project.url && project.lastSuccessAt ? 'Live' : 'Failed', ...(project.url && project.lastSuccessAt ? { lastDeployed: project.lastSuccessAt } : {}) }, attemptId);
      throw error;
    }
    return jsonResponse({ deploymentId: attemptId });
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

  async uploadSource(request: Request, env: ApiWorkerEnv, db: D1Database, projectId: string, serialized = false): Promise<Response> {
    const user = await this.requireAuth(request, db);
    const project = await projectService.getProjectById(db, projectId);
    if (!project || project.ownerId !== user.id) throw new UnauthorizedError('Only the project owner can upload deployment sources.');
    if (!serialized && env.APP_GATEWAY) return appGatewayController.projectMutation(request, env, projectId, user.id, 'upload-source');
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
    return staticPublication.stream(env, id);
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
