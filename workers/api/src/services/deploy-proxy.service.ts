import type { ApiWorkerEnv } from '../types/env';
import type { Project, ProjectMetadataOverrides, SourceType } from '../types/project';
import { CORS_HEADERS } from '../utils/http';
import { configService } from './config.service';
import { LogStreamMerger } from '../utils/log-stream-merger';

// ============================================================
// Types
// ============================================================

/** Headers that should be stripped when proxying requests */
type SkippedHeaderPrefix = 'cf-' | 'host' | 'content-length';

/** Extra headers to add to response */
type ExtraHeaders = Record<string, string>;

/** Input for /analyze endpoint */
export interface AnalyzeInput {
    id?: string;
    name?: string;
    repoUrl?: string;
    sourceType?: SourceType;
    htmlContent?: string;
    slug?: string;
}

/** Result from the /analyze endpoint */
export interface AnalyzeResult {
    metadata?: ProjectMetadataOverrides;
    analysisId?: string;
}

/** Input for /deploy endpoint - extends Project with deployment-specific fields */
export interface DeployInput extends Project {
    analysisId?: string;
    zipData?: string;
    deployTarget?: 'local' | 'cloudflare' | 'r2';
}

/** Parsed deploy response */
interface DeployResponse {
    deploymentId?: string;
}

// ============================================================
// Context API Types (for /context endpoint)
// ============================================================

/** Input for /context endpoint */
export interface ContextInput {
    repoUrl: string;
    sourceType: SourceType;
    zipData?: string;
    htmlContent?: string;
}

/** Package.json info extracted from project */
export interface PackageJsonInfo {
    name?: string;
    description?: string;
    version?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
}

/** Project context extracted by Node server */
export interface ProjectContext {
    indexHtml?: string;
    packageJson?: PackageJsonInfo;
    directoryTree: string[];
    readme?: string;
    framework?: string;
}

/** Result from /context endpoint */
export interface ContextResult {
    contextId: string;
    context: ProjectContext;
}

// ============================================================
// Service
// ============================================================

/**
 * Handles all HTTP proxy operations to the Node.js deploy server.
 * Centralizes header sanitization, CORS handling, and request forwarding.
 */
class DeployProxyService {
    /** Store active mergers by deployment ID for log injection */
    private activeMergers = new Map<string, LogStreamMerger>();

    /** Store pending logs for deployments before stream is created */
    private pendingLogs = new Map<string, Array<{ message: string; level: 'info' | 'warning' | 'error' | 'success' }>>();

    /**
     * Remove headers that shouldn't be forwarded to upstream.
     */
    private sanitizeHeaders = (source: Headers): Headers => {
        const headers = new Headers();
        source.forEach((value, key) => {
            const lower = key.toLowerCase() as SkippedHeaderPrefix | string;
            if (lower === 'host' || lower.startsWith('cf-') || lower === 'content-length') {
                return;
            }
            headers.set(key, value);
        });
        return headers;
    };

    /**
     * Add CORS headers to response.
     */
    private withCors = (response: Response, extra?: ExtraHeaders): Response => {
        const headers = new Headers(response.headers);
        Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));
        if (extra) {
            Object.entries(extra).forEach(([k, v]) => headers.set(k, v));
        }
        return new Response(response.body, { status: response.status, headers });
    };

    /**
     * Get base URL for deploy service.
     */
    private getBaseUrl = (env: ApiWorkerEnv): string => {
        return configService.getDeployServiceBaseUrl(env);
    };

    /**
     * Build target URL for a subpath.
     */
    private buildTargetUrl = (env: ApiWorkerEnv, subPath: string): string => {
        return `${this.getBaseUrl(env)}${subPath}`;
    };

    /**
     * Create headers with JSON content type.
     */
    private createJsonHeaders = (source: Headers): Headers => {
        const headers = this.sanitizeHeaders(source);
        headers.set('Content-Type', 'application/json');
        return headers;
    };

    // ============================================================
    // Public API
    // ============================================================

    /**
     * Proxy a request as-is to the deploy service.
     */
    proxyRequest = async (
        env: ApiWorkerEnv,
        request: Request,
        subPath: string,
    ): Promise<Response> => {
        const targetUrl = this.buildTargetUrl(env, subPath);
        const fetchOptions: RequestInit = {
            method: request.method,
            headers: this.sanitizeHeaders(request.headers),
        };

        if (request.method !== 'GET' && request.method !== 'HEAD') {
            fetchOptions.body = request.body;
        }

        const upstream = await fetch(targetUrl, fetchOptions);
        return this.withCors(upstream);
    };

    /**
   * Proxy a JSON body to the deploy service.
   */
    proxyJson = async (
        env: ApiWorkerEnv,
        request: Request,
        subPath: string,
        body: DeployInput,
    ): Promise<Response> => {
        const targetUrl = this.buildTargetUrl(env, subPath);
        const headers = this.createJsonHeaders(request.headers);

        const upstream = await fetch(targetUrl, {
            method: request.method,
            headers,
            body: JSON.stringify(body),
        });

        return this.withCors(upstream);
    };

    /**
     * Create a merged SSE stream that combines Node logs with Worker logs.
     * Returns both the Response (for frontend) and the merger (for log injection).
     */
    createMergedStream = async (
        env: ApiWorkerEnv,
        deploymentId: string,
    ): Promise<{ response: Response; merger: LogStreamMerger }> => {
        const nodeStream = await this.connectStream(env, deploymentId);
        if (!nodeStream) {
            throw new Error('Failed to connect to deployment stream');
        }

        const merger = new LogStreamMerger(nodeStream);
        const outputStream = merger.getOutputStream();

        // Store merger for potential log injection
        this.activeMergers.set(deploymentId, merger);

        // Inject any pending logs that were queued before stream was created
        const pending = this.pendingLogs.get(deploymentId);
        if (pending && pending.length > 0) {
            pending.forEach(({ message, level }) => {
                merger.injectLog(message, level);
            });
            this.pendingLogs.delete(deploymentId);
        }

        const headers = new Headers(CORS_HEADERS);
        headers.set('Content-Type', 'text/event-stream');
        headers.set('Cache-Control', 'no-cache');
        headers.set('Connection', 'keep-alive');

        const response = new Response(outputStream, {
            status: 200,
            headers,
        });

        return { response, merger };
    };

    /**
     * Get active merger for a deployment (if stream is connected).
     * Returns null if no stream is currently active for this deployment.
     */
    getMerger = (deploymentId: string): LogStreamMerger | null => {
        return this.activeMergers.get(deploymentId) ?? null;
    };

    /**
     * Inject a log into an active deployment stream.
     * If stream hasn't been created yet, queues the log for later injection.
     */
    injectLog = (deploymentId: string, message: string, level: 'info' | 'warning' | 'error' | 'success' = 'info'): void => {
        const merger = this.getMerger(deploymentId);
        if (merger) {
            // Stream exists, inject immediately
            merger.injectLog(message, level);
        } else {
            // Stream doesn't exist yet, queue for later
            if (!this.pendingLogs.has(deploymentId)) {
                this.pendingLogs.set(deploymentId, []);
            }
            this.pendingLogs.get(deploymentId)!.push({ message, level });
        }
    };

    /**
     * Clean up merger and pending logs when stream closes.
     */
    cleanupMerger = (deploymentId: string): void => {
        this.activeMergers.delete(deploymentId);
        this.pendingLogs.delete(deploymentId);
    };

    /**
     * Proxy SSE stream from deploy service.
     */
    proxyStream = async (
        env: ApiWorkerEnv,
        request: Request,
        deploymentId: string,
    ): Promise<Response> => {
        const targetUrl = this.buildTargetUrl(
            env,
            `/deployments/${encodeURIComponent(deploymentId)}/stream`,
        );

        const upstream = await fetch(targetUrl, {
            method: 'GET',
            headers: this.sanitizeHeaders(request.headers),
        });

        const contentType = upstream.headers.get('content-type') ?? '';
        const isEventStream = contentType.includes('text/event-stream');

        const sseHeaders: ExtraHeaders | undefined = isEventStream
            ? { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' }
            : undefined;

        return this.withCors(upstream, sseHeaders);
    };

    /**
   * Call /analyze endpoint and return parsed result.
   */
    analyze = async (
        env: ApiWorkerEnv,
        request: Request,
        body: AnalyzeInput,
    ): Promise<AnalyzeResult> => {
        const targetUrl = this.buildTargetUrl(env, '/analyze');
        const headers = this.createJsonHeaders(request.headers);

        const upstream = await fetch(targetUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });

        if (!upstream.ok) {
            const text = await upstream.text().catch(() => '');
            throw new Error(text || `Analysis failed with status ${upstream.status}`);
        }

        return (await upstream.json().catch(() => ({}))) as AnalyzeResult;
    };

    /**
     * Parse deploymentId from deploy response.
     */
    parseDeploymentId = async (response: Response): Promise<string | undefined> => {
        try {
            const data = (await response.clone().json()) as DeployResponse;
            return data.deploymentId;
        } catch {
            return undefined;
        }
    };

    /**
     * Call /context endpoint to extract project context.
     */
    getContext = async (
        env: ApiWorkerEnv,
        input: ContextInput,
    ): Promise<ContextResult> => {
        const targetUrl = this.buildTargetUrl(env, '/context');

        const upstream = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });

        if (!upstream.ok) {
            const text = await upstream.text().catch(() => '');
            throw new Error(text || `Context extraction failed with status ${upstream.status}`);
        }

        return (await upstream.json()) as ContextResult;
    };

    /**
     * Connect to deploy stream and read SSE events (for background monitoring).
     */
    connectStream = async (
        env: ApiWorkerEnv,
        deploymentId: string,
    ): Promise<ReadableStream<Uint8Array> | null> => {
        const targetUrl = this.buildTargetUrl(
            env,
            `/deployments/${encodeURIComponent(deploymentId)}/stream`,
        );

        const upstream = await fetch(targetUrl, { method: 'GET' });
        return upstream.body;
    };
}

export const deployProxyService = new DeployProxyService();
