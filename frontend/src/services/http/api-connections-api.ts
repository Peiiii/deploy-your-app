import { APP_CONFIG } from '@/constants';

export interface ApiConnection {
  name: string;
  protocol: 'openai-chat' | 'qwen-realtime' | 'http';
  baseUrl: string;
  secretName: string;
  authHeader: string;
  authPrefix: string;
  access: 'login' | 'public';
  enabled: boolean;
  models: string[];
  method: 'GET' | 'POST';
  path: string;
  limits: {
    userDaily: number;
    appDaily: number;
    concurrency: number;
    userConcurrency: number;
    durationSeconds: number;
    outputTokens: number;
  };
}
export interface ApiConnectionSettings {
  secrets: { name: string; version: number; updatedAt: number }[];
  connections: ApiConnection[];
  usage: { requests: number; active: number };
}
export async function apiConnectionRequest<T>(
  projectId: string,
  path = 'api-connections',
  method = 'GET',
  body?: unknown
): Promise<T> {
  const response = await fetch(
    `${APP_CONFIG.API_BASE_URL.replace(/\/+$/, '')}/projects/${encodeURIComponent(projectId)}/${path}`,
    {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : JSON.stringify(body || {}),
    }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'The API connection could not be saved.');
  return data as T;
}
