import { randomUUID } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import {
  deployments,
  streams,
  analysisSessions,
  type StreamClient,
} from '../modules/deployment/state.js';
import type { Project } from '../common/types.js';
import { SourceType } from '../common/types.js';
import { deploymentService } from '../modules/deployment/deployment.service.js';
import { metadataService } from '../modules/metadata/index.js';
import { CONFIG } from '../common/config/config.js';
import { materializeSourceForDeployment } from '../modules/deployment/pipeline/sourceMaterialization.js';

// Minimal request/response/app types so we don't pull in full Express types
// but also avoid using `any`.
type RequestLike = {
  body?: unknown;
  params?: Record<string, string>;
  on: (event: 'close', listener: () => void) => void;
};

type ResponseLike = StreamClient & {
  json: (body: unknown) => void;
  status: (code: number) => ResponseLike;
  writeHead: (statusCode: number, headers: Record<string, string>) => void;
};

type RouteHandler = (req: RequestLike, res: ResponseLike) => void | Promise<void>;

type AppLike = {
  get(path: string, handler: RouteHandler): void;
  post(path: string, handler: RouteHandler): void;
  patch?(path: string, handler: RouteHandler): void;
};

// Attach all API routes to the given Express app instance.
export function registerRoutes(app: AppLike): void {
  // ----------------------
  // Pre-deployment analysis
  // ----------------------

  app.post('/api/v1/analyze', async (req, res) => {
    const project = (req.body || {}) as Project;

    if (!project || !project.name || !project.repoUrl) {
      return res
        .status(400)
        .json({ error: 'project.name and project.repoUrl are required' });
    }

    const normalizedSourceType = project.sourceType ?? SourceType.GitHub;

    // For now we only perform a full repository-based analysis for GitHub
    // sources. Other source types fall back to a lightweight metadata
    // generation that does not require preparing a work directory.
    if (normalizedSourceType !== SourceType.GitHub) {
      const metadata = await metadataService.ensureProjectMetadata({
        seedName: project.name,
        identifier: project.repoUrl,
        sourceType: normalizedSourceType,
        htmlContent: project.htmlContent,
        workDir: null,
      });
      return res.json({ metadata });
    }

    const analysisId = randomUUID();
    const workDir = path.join(
      CONFIG.paths.buildsRoot,
      `analysis-${analysisId}`,
    );

    try {
      const tempProject: Project = {
        id: analysisId,
        name: project.name,
        repoUrl: project.repoUrl,
        sourceType: SourceType.GitHub,
        slug: undefined,
        analysisId,
        lastDeployed: '',
        status: 'Building',
        url: undefined,
        description: project.description,
        framework: 'Unknown',
        category: project.category,
        tags: project.tags,
        deployTarget: project.deployTarget,
        providerUrl: undefined,
        cloudflareProjectName: undefined,
        htmlContent: project.htmlContent,
      };

      // Prepare a work directory with the repository contents so that the
      // metadata service can build a context from the actual source code.
      await materializeSourceForDeployment(analysisId, tempProject, workDir);

      const metadata = await metadataService.ensureProjectMetadata({
        seedName: project.name,
        identifier: project.repoUrl,
        sourceType: SourceType.GitHub,
        htmlContent: project.htmlContent,
        workDir,
      });

      analysisSessions.set(analysisId, {
        workDir,
        repoUrl: project.repoUrl,
        filePath: '',
      });

      return res.json({ analysisId, metadata });
    } catch (err) {
      // Best-effort cleanup of the analysis workdir if anything goes wrong
      // before a deployment job reuses it.
      try {
        await fs.promises.rm(workDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
      analysisSessions.delete(analysisId);

      const message =
        err && (err as Error).message ? (err as Error).message : String(err);
      return res.status(500).json({ error: message });
    }
  });

  // ----------------------
  // Start deployment job
  // ----------------------

  app.post('/api/v1/deploy', (req, res) => {
    const { zipData, ...rest } = (req.body || {}) as {
      zipData?: string;
    } & (Project & { analysisId?: string });

    const project = rest as Project & { analysisId?: string };

    if (!project || !project.name || !project.repoUrl) {
      return res
        .status(400)
        .json({ error: 'project.name and project.repoUrl are required' });
    }

    // Project-first enforcement: deployments must be tied to an existing
    // project record with a stable slug, rather than generating new slugs
    // (and therefore new URLs/resources) on every deploy attempt.
    if (!project.slug || project.slug.trim().length === 0) {
      return res.status(400).json({
        error:
          'project.slug is required. Create a project first and ensure analysis/AI has produced a slug.',
      });
    }

    const id = randomUUID();
    const workDirFromAnalysis =
      project.analysisId && analysisSessions.has(project.analysisId)
        ? analysisSessions.get(project.analysisId)!.workDir
        : null;

    deployments.set(id, {
      status: 'IDLE',
      logs: [],
      project,
      workDir: workDirFromAnalysis,
      zipData,
    });

    res.json({ deploymentId: id });

    // Fire and forget async job
    deploymentService.runDeployment(id).catch((err) => {
      console.error('Deployment job failed', err);
    });
  });

  // ----------------------
  // Deployment log stream (SSE)
  // ----------------------

  app.get('/api/v1/deployments/:id/stream', (req, res) => {
    const { id } = req.params as { id: string };

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('\n');

    let listeners = streams.get(id);
    if (!listeners) {
      listeners = new Set();
      streams.set(id, listeners);
    }
    listeners.add(res);

    // Send existing logs and status immediately
    const deployment = deployments.get(id);
    if (deployment) {
      for (const log of deployment.logs) {
        res.write(
          `data: ${JSON.stringify({
            type: 'log',
            message: log.message,
            level: log.level || 'info',
          })}\n\n`,
        );
      }
      res.write(
        `data: ${JSON.stringify({
          type: 'status',
          status: deployment.status,
        })}\n\n`,
      );
    }

    const keepAlive = setInterval(() => {
      res.write(':\n\n');
    }, 15000);

    req.on('close', () => {
      clearInterval(keepAlive);
      const set = streams.get(id);
      if (set) {
        set.delete(res);
        if (set.size === 0) {
          streams.delete(id);
        }
      }
    });
  });
}
