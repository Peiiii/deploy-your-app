import type { ApiWorkerEnv } from '../types/env';
import { CORS_HEADERS } from '../utils/http';
import { configService } from '../services/config.service';

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
  ): Promise<Response> {
    return this.proxyDeployRequest(env, request, '/deploy');
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
