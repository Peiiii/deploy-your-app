import { randomUUID } from 'crypto';
import {
  deployments,
  streams,
  analysisSessions,
  type StreamClient,
} from '../modules/deployment/state.js';
import type { Project } from '../common/types.js';
import { deploymentService } from '../modules/deployment/deployment.service.js';

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
