import type { ApiWorkerEnv } from '../types/env';
import { readJson } from '../utils/http';
import { configService } from '../services/config.service';
import { NotFoundError, UnauthorizedError, ValidationError } from '../utils/error-handler';
import { getSessionIdFromRequest } from '../utils/auth';
import { authRepository } from '../repositories/auth.repository';
import { projectService } from '../services/project.service';
import { deployService } from '../services/deploy.service';
import { deployProxyService } from '../services/deploy-proxy.service';

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

    // 4. Resolve source type and validate inputs
    const sourceType = deployService.resolveSourceType(input, project);
    const htmlContent = input.htmlContent || project.htmlContent;
    deployService.validateSourceInputs(sourceType, project, { ...input, htmlContent });

    // 5. Ensure project has slug (via AI analysis if needed)
    const enrichResult = await deployService.ensureProjectHasSlug(
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

    const forwardBody = input.zipData ? { ...payload, zipData: input.zipData } : payload;
    const response = await deployProxyService.proxyJson(env, request, '/deploy', forwardBody);

    // 8. Start background monitoring and inject enrichment logs
    const deploymentId = await deployProxyService.parseDeploymentId(response);
    if (deploymentId) {
      // Inject enrichment debug logs (will be queued if stream not yet created)
      if (enrichResult.debugLogs.length > 0) {
        const logHeader = '═══ Project Enrichment Debug ═══';
        deployProxyService.injectLog(deploymentId, logHeader, 'info');

        enrichResult.debugLogs.forEach(log => {
          deployProxyService.injectLog(deploymentId, log, 'info');
        });

        deployProxyService.injectLog(deploymentId, '═══════════════════════════════', 'info');
      }

      void deployService.monitorDeployment(env, db, deploymentId, project.id);
    }

    return response;
  }

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
  ): Promise<Response> {
    // Use merged stream instead of simple proxy
    // This allows Worker to inject its own logs
    const { response } = await deployProxyService.createMergedStream(env, id);
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
