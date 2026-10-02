import { randomUUID } from 'node:crypto';
import type {
  CliUser,
  CreateProjectPayload,
  ProjectResponse,
} from './types.js';

export interface StreamLogEvent {
  type: 'log';
  message: string;
  level?: 'info' | 'warning' | 'error' | 'success';
}

export interface StreamStatusEvent {
  type: 'status';
  status: string;
  errorMessage?: string;
  projectMetadata?: {
    name?: string;
    slug?: string;
    description?: string;
    category?: string;
    tags?: string[];
    url?: string;
  };
}

export type DeploymentStreamEvent = StreamLogEvent | StreamStatusEvent;

export function extractSessionCookie(setCookieHeader: string | null): string {
  if (!setCookieHeader) {
    throw new Error('Login succeeded but no session cookie was returned.');
  }

  const match = setCookieHeader.match(/session_id=[^;]+/);
  if (!match) {
    throw new Error('Login succeeded but session_id cookie was missing.');
  }

  return match[0];
}

function extractSseEvents(buffer: string): { events: string[]; rest: string } {
  const events: string[] = [];
  let rest = buffer;
  let splitIndex = rest.indexOf('\n\n');

  while (splitIndex !== -1) {
    const chunk = rest.slice(0, splitIndex);
    rest = rest.slice(splitIndex + 2);
    const line = chunk
      .split('\n')
      .find((entry) => entry.trim().startsWith('data:'));
    if (line) {
      events.push(line.replace(/^data:\s*/, ''));
    }
    splitIndex = rest.indexOf('\n\n');
  }

  return { events, rest };
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T;
  return data;
}

export class GemigoApiClient {
  private origin: string;
  private cookie?: string;

  constructor(origin: string, cookie?: string) {
    this.origin = origin.replace(/\/+$/, '');
    this.cookie = cookie;
  }

  private buildHeaders(
    extraHeaders?: Record<string, string>,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      ...(extraHeaders ?? {}),
    };
    if (this.cookie) {
      headers.Cookie = this.cookie;
    }
    return headers;
  }

  async exchangeDeviceToken(
    token: string,
  ): Promise<{ cookie: string; user: CliUser }> {
    const response = await fetch(
      `${this.origin}/api/v1/auth/desktop/login?token=${encodeURIComponent(token)}`,
      {
        method: 'GET',
      },
    );

    if (!response.ok) {
      const data = await parseJsonResponse<{ error?: string }>(response);
      throw new Error(data.error ?? 'Failed to exchange login token.');
    }

    const cookie = extractSessionCookie(response.headers.get('set-cookie'));
    const data = await parseJsonResponse<{ user?: CliUser }>(response);
    if (!data.user) {
      throw new Error('Login succeeded but user payload was missing.');
    }

    this.cookie = cookie;
    return {
      cookie,
      user: data.user,
    };
  }

  async getCurrentUser(): Promise<CliUser | null> {
    const response = await fetch(`${this.origin}/api/v1/me`, {
      headers: this.buildHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to load current user.');
    }

    const data = await parseJsonResponse<{ user?: CliUser | null }>(response);
    return data.user ?? null;
  }

  async createProject(input: CreateProjectPayload): Promise<ProjectResponse> {
    const response = await fetch(`${this.origin}/api/v1/projects`, {
      method: 'POST',
      headers: this.buildHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({ ...input, clientChannel: 'cli' }),
    });

    if (!response.ok) {
      const data = await parseJsonResponse<{ error?: string }>(response);
      throw new Error(data.error ?? 'Failed to create project.');
    }

    return parseJsonResponse<ProjectResponse>(response);
  }

  async uploadDeploymentSource(projectId: string, bytes: Buffer): Promise<{ zipSourceKey: string }> {
    const response = await fetch(`${this.origin}/api/v1/projects/${encodeURIComponent(projectId)}/deployment-source`, {
      method: 'PUT', headers: this.buildHeaders({ 'Content-Type': 'application/zip' }),
      body: new Blob([new Uint8Array(bytes)]),
    });
    const data = await parseJsonResponse<{ zipSourceKey?: string; error?: string }>(response);
    if (!response.ok || !data.zipSourceKey) throw new Error(data.error ?? 'ZIP upload failed. Please try again.');
    return { zipSourceKey: data.zipSourceKey };
  }

  async startDeployment(input: {
    id: string;
    sourceType: 'zip';
    zipSourceKey: string;
  }): Promise<{ deploymentId: string }> {
    const body = JSON.stringify({ ...input, clientChannel: 'cli', deploymentFlowId: randomUUID() });
    let response: Response | undefined;
    for (let retry = 0; retry < 3; retry++) {
      try {
        response = await fetch(`${this.origin}/api/v1/deploy`, {
          method: 'POST', headers: this.buildHeaders({ 'Content-Type': 'application/json' }), body,
          signal: AbortSignal.timeout(30000),
        });
        if (response.status < 500) break;
      } catch { /* Same flow safely recovers an accepted request. */ }
      if (retry < 2) await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (!response || response.status >= 500) throw new Error('Deployment acceptance is still being confirmed. Check your dashboard; this does not mean the build failed.');
    if (!response.ok) {
      const data = await parseJsonResponse<{ error?: string }>(response);
      throw new Error(data.error ?? 'Failed to start deployment.');
    }

    const data = await parseJsonResponse<{ deploymentId?: string }>(response);
    if (!data.deploymentId) {
      throw new Error('Deployment started but no deploymentId was returned.');
    }

    return {
      deploymentId: data.deploymentId,
    };
  }

  async streamDeployment(
    deploymentId: string,
    handlers?: {
      onLog?: (event: StreamLogEvent) => void;
      onStatus?: (event: StreamStatusEvent) => void;
    },
  ): Promise<StreamStatusEvent> {
    const deadline = Date.now() + 10 * 60 * 1000;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const response = await fetch(`${this.origin}/api/v1/deployments/${encodeURIComponent(deploymentId)}/stream`, {
        headers: this.buildHeaders(), signal: AbortSignal.timeout(10 * 60 * 1000),
      });
      if (!response.ok || !response.body) throw new Error('Log stream is unavailable.');
      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parsed = extractSseEvents(buffer);
        buffer = parsed.rest;
        for (const rawEvent of parsed.events) {
          const event = JSON.parse(rawEvent) as DeploymentStreamEvent;
          if (event.type === 'log') handlers?.onLog?.(event);
          else if (event.type === 'status') {
            handlers?.onStatus?.(event);
            if (event.status === 'SUCCESS' || event.status === 'FAILED') return event;
          }
        }
      }
    } catch {
      handlers?.onLog?.({ type: 'log', level: 'warning', message: 'Log connection interrupted. Deployment continues; checking its result.' });
    } finally { await reader?.cancel().catch(() => {}); }
    while (Date.now() < deadline) {
      let sessionExpired = false;
      try {
        const response = await fetch(`${this.origin}/api/v1/deployments/${encodeURIComponent(deploymentId)}/reconcile`, {
          method: 'POST', headers: this.buildHeaders(), signal: AbortSignal.timeout(10000),
        });
        if (response.status === 401 || response.status === 403) sessionExpired = true;
        if (response.ok) {
          const status = await parseJsonResponse<StreamStatusEvent>(response);
          handlers?.onStatus?.(status);
          if (status.status === 'SUCCESS' || status.status === 'FAILED') return status;
        }
      } catch { /* Recover transient network failures without changing deployment state. */ }
      if (sessionExpired) throw new Error('Session expired. Sign in again to check the deployment.');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    throw new Error('Deployment result is still pending. Check your dashboard; this does not mean the build failed.');
  }
}
