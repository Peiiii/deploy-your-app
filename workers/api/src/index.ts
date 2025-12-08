import { ProjectRepository } from './repositories/project.repository';
import { MetadataService } from './services/metadata.service';
import { ProjectService } from './services/project.service';
import type { ApiWorkerEnv } from './types/env';
import { SourceType, type ProjectMetadataOverrides } from './types/project';
import {
  jsonResponse,
  emptyResponse,
  normalizePath,
  CORS_HEADERS,
} from './utils/http';

type JsonBody = Record<string, unknown>;

function parseMetadataOverrides(
  value: unknown,
): ProjectMetadataOverrides | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const input = value as Record<string, unknown>;
  const metadata: ProjectMetadataOverrides = {};

  if (typeof input.name === 'string') {
    metadata.name = input.name;
  }
  if (typeof input.slug === 'string') {
    metadata.slug = input.slug;
  }
  if (typeof input.description === 'string') {
    metadata.description = input.description;
  }
  if (typeof input.category === 'string') {
    metadata.category = input.category;
  }
  if (Array.isArray(input.tags)) {
    metadata.tags = input.tags
      .filter((tag): tag is string => typeof tag === 'string')
      .map((tag) => tag);
  }

  return metadata;
}

function toSourceType(value: unknown): SourceType | undefined {
  if (typeof value !== 'string') return undefined;
  return Object.values(SourceType).includes(value as SourceType)
    ? (value as SourceType)
    : undefined;
}

async function readJson(req: Request): Promise<JsonBody> {
  if (
    !req.headers.get('content-type')?.includes('application/json') &&
    req.headers.get('content-length')
  ) {
    throw new Error('Expected application/json request');
  }

  if (req.headers.get('content-length') === null) {
    return {};
  }

  try {
    const data = (await req.json()) as JsonBody;
    return data;
  } catch {
    throw new Error('Invalid JSON body');
  }
}

async function handleRequest(
  request: Request,
  env: ApiWorkerEnv,
): Promise<Response> {
  const url = new URL(request.url);
  const pathname = normalizePath(url.pathname);

  if (request.method === 'OPTIONS') {
    return emptyResponse(204);
  }

  if (pathname === '/api/v1/deploy' && request.method === 'POST') {
    return proxyDeployRequest(request, env, '/deploy');
  }

  const streamMatch = pathname.match(
    /^\/api\/v1\/deployments\/([^/]+)\/stream$/,
  );
  if (streamMatch && request.method === 'GET') {
    return proxyDeployStream(request, env, streamMatch[1]);
  }

  // All project-related routes require a configured D1 binding.
  if (!env.PROJECTS_DB) {
    console.error('PROJECTS_DB binding is missing in Worker environment.');
    return jsonResponse(
      { error: 'Database is not configured for this API worker.' },
      500,
    );
  }

  const repository = new ProjectRepository(env.PROJECTS_DB);
  const metadataService = new MetadataService(env);
  const projectService = new ProjectService(
    repository,
    metadataService,
    env,
  );

  if (pathname === '/api/v1/projects' && request.method === 'GET') {
    const projects = await projectService.getProjects();
    return jsonResponse(projects);
  }

  if (pathname === '/api/v1/projects' && request.method === 'POST') {
    let body: JsonBody;
    try {
      body = await readJson(request);
    } catch (err) {
      return jsonResponse({ error: (err as Error).message }, 400);
    }

    const { name, sourceType, identifier, htmlContent, metadata } = body;
    if (typeof name !== 'string' || typeof identifier !== 'string') {
      return jsonResponse(
        { error: 'name and identifier are required' },
        400,
      );
    }

    try {
      const project = await projectService.createProject({
        name,
        identifier,
        sourceType: toSourceType(sourceType),
        htmlContent:
          typeof htmlContent === 'string' ? htmlContent : undefined,
        metadata: parseMetadataOverrides(metadata),
      });
      return jsonResponse(project);
    } catch (err) {
      console.error('Failed to create project', err);
      return jsonResponse({ error: 'Failed to create project' }, 500);
    }
  }

  if (pathname.startsWith('/api/v1/projects/') && request.method === 'PATCH') {
    const id = decodeURIComponent(pathname.replace('/api/v1/projects/', ''));
    let body: JsonBody;
    try {
      body = await readJson(request);
    } catch (err) {
      return jsonResponse({ error: (err as Error).message }, 400);
    }

    const { name, repoUrl, description, category, tags } = body;
    if (
      name === undefined &&
      repoUrl === undefined &&
      description === undefined &&
      category === undefined &&
      tags === undefined
    ) {
      return jsonResponse(
        {
          error:
            'At least one of name, repoUrl, description, category or tags must be provided',
        },
        400,
      );
    }

    const project = await projectService.updateProject(id, {
      ...(typeof name === 'string' ? { name } : {}),
      ...(typeof repoUrl === 'string' ? { repoUrl } : {}),
      ...(typeof description === 'string' ? { description } : {}),
      ...(typeof category === 'string' ? { category } : {}),
      ...(Array.isArray(tags)
        ? {
            tags: tags
              .filter((tag): tag is string => typeof tag === 'string')
              .map((tag) => tag),
          }
        : {}),
    });

    if (!project) {
      return jsonResponse({ error: 'Project not found' }, 404);
    }

    return jsonResponse(project);
  }

  return jsonResponse({ error: 'Not Found' }, 404);
}

const worker: ExportedHandler<ApiWorkerEnv> = {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (err) {
      console.error('Worker request failed', err);
      return jsonResponse({ error: 'Internal Server Error' }, 500);
    }
  },
};

export default worker;

function resolveDeployServiceBaseUrl(env: ApiWorkerEnv): string {
  const raw = env.DEPLOY_SERVICE_BASE_URL?.trim();
  if (raw && raw.length > 0) {
    return raw.replace(/\/+$/, '');
  }
  return 'http://127.0.0.1:4173/api/v1';
}

function sanitizeForwardHeaders(source: Headers): Headers {
  const headers = new Headers();
  source.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === 'host' || lower.startsWith('cf-') || lower === 'content-length') {
      return;
    }
    headers.set(key, value);
  });
  return headers;
}

function withCorsResponse(response: Response, extra?: Record<string, string>): Response {
  const headers = new Headers(response.headers);
  Object.entries(CORS_HEADERS).forEach(([key, value]) => headers.set(key, value));
  if (extra) {
    Object.entries(extra).forEach(([key, value]) => headers.set(key, value));
  }
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

async function proxyDeployRequest(
  request: Request,
  env: ApiWorkerEnv,
  subPath: string,
): Promise<Response> {
  const baseUrl = resolveDeployServiceBaseUrl(env);
  const targetUrl = `${baseUrl}${subPath}`;
  const upstream = await fetch(targetUrl, {
    method: request.method,
    headers: sanitizeForwardHeaders(request.headers),
    body: request.body,
  });
  return withCorsResponse(upstream);
}

async function proxyDeployStream(
  request: Request,
  env: ApiWorkerEnv,
  deploymentId: string,
): Promise<Response> {
  const baseUrl = resolveDeployServiceBaseUrl(env);
  const targetUrl = `${baseUrl}/deployments/${encodeURIComponent(deploymentId)}/stream`;
  const upstream = await fetch(targetUrl, {
    method: 'GET',
    headers: sanitizeForwardHeaders(request.headers),
  });

  const contentType = upstream.headers.get('content-type') ?? '';
  const isEventStream = contentType.includes('text/event-stream');
  return withCorsResponse(
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
