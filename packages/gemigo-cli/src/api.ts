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
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const data = await parseJsonResponse<{ error?: string }>(response);
      throw new Error(data.error ?? 'Failed to create project.');
    }

    return parseJsonResponse<ProjectResponse>(response);
  }

  async startDeployment(input: {
    id: string;
    sourceType: 'zip';
    zipData: string;
  }): Promise<{ deploymentId: string }> {
    const response = await fetch(`${this.origin}/api/v1/deploy`, {
      method: 'POST',
      headers: this.buildHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(input),
    });

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
    const response = await fetch(
      `${this.origin}/api/v1/deployments/${encodeURIComponent(deploymentId)}/stream`,
      {
        headers: this.buildHeaders(),
      },
    );

    if (!response.ok || !response.body) {
      throw new Error('Failed to open deployment log stream.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const { events, rest } = extractSseEvents(buffer);
      buffer = rest;

      for (const rawEvent of events) {
        const parsed = JSON.parse(rawEvent) as DeploymentStreamEvent;
        if (parsed.type === 'log') {
          handlers?.onLog?.(parsed);
        } else if (parsed.type === 'status') {
          handlers?.onStatus?.(parsed);
          if (parsed.status === 'SUCCESS' || parsed.status === 'FAILED') {
            return parsed;
          }
        }
      }
    }

    throw new Error('Deployment stream closed before completion.');
  }
}
