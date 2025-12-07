import { randomUUID } from 'crypto';
import {
  deployments,
  streams,
  analysisSessions,
  type StreamClient,
} from '../modules/deployment/state.js';
import type { Project } from '../common/types.js';
import { SourceType } from '../common/types.js';
import { runDeployment } from '../modules/deployment/deploymentService.js';
import { createProject, getProjects, updateProject } from '../modules/projects/projectService.js';
import type { ProjectMetadataOverrides } from '../modules/metadata/index.js';

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

function parseMetadataOverrides(value: unknown): ProjectMetadataOverrides | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const input = value as Record<string, unknown>;
  const metadata: ProjectMetadataOverrides = {};

  if (typeof input.name === 'string') {
    metadata.name = String(input.name);
  }
  if (typeof input.slug === 'string') {
    metadata.slug = String(input.slug);
  }
  if (typeof input.description === 'string') {
    metadata.description = String(input.description);
  }
  if (typeof input.category === 'string') {
    metadata.category = String(input.category);
  }
  if (Array.isArray(input.tags)) {
    metadata.tags = input.tags
      .filter((tag): tag is string => typeof tag === 'string')
      .map((tag) => String(tag));
  }

  return metadata;
}

// Attach all API routes to the given Express app instance.
export function registerRoutes(app: AppLike): void {
  // ----------------------
  // Projects CRUD
  // ----------------------

  app.get('/api/v1/projects', (req, res) => {
    res.json(getProjects());
  });

  app.post('/api/v1/projects', async (req, res) => {
    const body = (req.body ?? {}) as {
      name?: unknown;
      sourceType?: unknown;
      identifier?: unknown;
      htmlContent?: unknown;
      metadata?: unknown;
    };
    const { name, sourceType, identifier, htmlContent, metadata } = body;

    if (!name || !identifier) {
      return res.status(400).json({ error: 'name and identifier are required' });
    }

    const rawSourceType =
      typeof sourceType === 'string' ? sourceType : undefined;
    const normalizedSourceType =
      rawSourceType &&
      Object.values(SourceType).includes(rawSourceType as SourceType)
        ? (rawSourceType as SourceType)
        : undefined;
    const metadataOverrides = parseMetadataOverrides(metadata);

    try {
      const project = await createProject({
        name: String(name),
        sourceType: normalizedSourceType,
        identifier: String(identifier),
        htmlContent:
          typeof htmlContent === 'string' ? htmlContent : undefined,
        metadata: metadataOverrides,
      });
      res.json(project);
    } catch (err) {
      console.error('Failed to create project', err);
      res.status(500).json({ error: 'Failed to create project' });
    }
  });

  const patch =
    typeof app.patch === 'function'
      ? app.patch.bind(app)
      : (path: string, handler: RouteHandler) => {
          // If the host app没有实现 patch，我们退化为 post 兼容（主要为了类型通过）。
          app.post(path, handler);
        };

  patch('/api/v1/projects/:id', (req, res) => {
    const { id } = req.params as { id: string };
    const { name, repoUrl, description, category, tags } = req.body || {};

    if (
      name === undefined &&
      repoUrl === undefined &&
      description === undefined &&
      category === undefined &&
      tags === undefined
    ) {
      return res
        .status(400)
        .json({
          error:
            'At least one of name, repoUrl, description, category or tags must be provided',
        });
    }

    const project = updateProject(id, {
      ...(name !== undefined ? { name: String(name) } : {}),
      ...(repoUrl !== undefined ? { repoUrl: String(repoUrl) } : {}),
      ...(description !== undefined
        ? { description: String(description) }
        : {}),
      ...(category !== undefined ? { category: String(category) } : {}),
      ...(Array.isArray(tags)
        ? { tags: (tags as unknown[]).map((t) => String(t)) }
        : {}),
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  });

  // ----------------------
  // Code analysis (stubbed)
  // ----------------------

  app.post('/api/v1/analyze', async (req, res) => {
    const body = (req.body ?? {}) as { sourceCode?: unknown };
    const { sourceCode } = body;

    if (typeof sourceCode !== 'string') {
      return res
        .status(400)
        .json({ error: 'sourceCode must be provided as a string.' });
    }

    // For now, we simply echo back the source and explain that analysis is disabled.
    return res.json({
      refactoredCode: sourceCode,
      explanation:
        'AI analysis is currently disabled for this environment. Code was not modified.',
    });
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
    runDeployment(id).catch((err) => {
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
