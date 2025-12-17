import type { ApiWorkerEnv } from '../types/env';
import { CORS_HEADERS } from '../utils/http';
import { configService } from './config.service';

/**
 * Handles all HTTP proxy operations to the Node.js deploy server.
 * Centralizes header sanitization, CORS handling, and request forwarding.
 */
class DeployProxyService {
    private sanitizeHeaders(source: Headers): Headers {
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

    private withCors(response: Response, extra?: Record<string, string>): Response {
        const headers = new Headers(response.headers);
        Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));
        if (extra) {
            Object.entries(extra).forEach(([k, v]) => headers.set(k, v));
        }
        return new Response(response.body, { status: response.status, headers });
    }

    private getBaseUrl(env: ApiWorkerEnv): string {
        return configService.getDeployServiceBaseUrl(env);
    }

    /** Proxy a request as-is to the deploy service */
    async proxyRequest(env: ApiWorkerEnv, request: Request, subPath: string): Promise<Response> {
        const targetUrl = `${this.getBaseUrl(env)}${subPath}`;
        const fetchOptions: RequestInit = {
            method: request.method,
            headers: this.sanitizeHeaders(request.headers),
        };
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            fetchOptions.body = request.body;
        }
        const upstream = await fetch(targetUrl, fetchOptions);
        return this.withCors(upstream);
    }

    /** Proxy a JSON body to the deploy service */
    async proxyJson(env: ApiWorkerEnv, request: Request, subPath: string, body: unknown): Promise<Response> {
        const targetUrl = `${this.getBaseUrl(env)}${subPath}`;
        const headers = this.sanitizeHeaders(request.headers);
        headers.set('Content-Type', 'application/json');
        const upstream = await fetch(targetUrl, {
            method: request.method,
            headers,
            body: JSON.stringify(body),
        });
        return this.withCors(upstream);
    }

    /** Proxy SSE stream from deploy service */
    async proxyStream(env: ApiWorkerEnv, request: Request, deploymentId: string): Promise<Response> {
        const targetUrl = `${this.getBaseUrl(env)}/deployments/${encodeURIComponent(deploymentId)}/stream`;
        const upstream = await fetch(targetUrl, {
            method: 'GET',
            headers: this.sanitizeHeaders(request.headers),
        });
        const contentType = upstream.headers.get('content-type') ?? '';
        const isEventStream = contentType.includes('text/event-stream');
        return this.withCors(
            upstream,
            isEventStream
                ? { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' }
                : undefined,
        );
    }

    /** Call /analyze endpoint and return parsed result */
    async analyze(
        env: ApiWorkerEnv,
        request: Request,
        body: unknown,
    ): Promise<{ metadata?: Record<string, unknown>; analysisId?: string }> {
        const targetUrl = `${this.getBaseUrl(env)}/analyze`;
        const headers = this.sanitizeHeaders(request.headers);
        headers.set('Content-Type', 'application/json');
        const upstream = await fetch(targetUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });
        if (!upstream.ok) {
            const text = await upstream.text().catch(() => '');
            throw new Error(text || `Analysis failed with status ${upstream.status}`);
        }
        return (await upstream.json().catch(() => ({}))) as { metadata?: Record<string, unknown>; analysisId?: string };
    }

    /** Parse deploymentId from deploy response */
    async parseDeploymentId(response: Response): Promise<string | undefined> {
        try {
            const data = (await response.clone().json()) as { deploymentId?: string };
            return data.deploymentId;
        } catch {
            return undefined;
        }
    }

    /** Connect to deploy stream and read SSE events (for background monitoring) */
    async connectStream(env: ApiWorkerEnv, deploymentId: string): Promise<ReadableStream<Uint8Array> | null> {
        const targetUrl = `${this.getBaseUrl(env)}/deployments/${encodeURIComponent(deploymentId)}/stream`;
        const upstream = await fetch(targetUrl, { method: 'GET' });
        return upstream.body;
    }
}

export const deployProxyService = new DeployProxyService();
