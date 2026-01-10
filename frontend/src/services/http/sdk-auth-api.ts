import { APP_CONFIG } from '@/constants';

export async function sdkAuthorize(input: {
  appId: string;
  scopes: string[];
  codeChallenge: string;
}): Promise<{ code: string; expiresIn: number }> {
  const res = await fetch(`${APP_CONFIG.API_BASE_URL}/sdk/authorize`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (res.status === 401) {
    throw new Error('unauthorized');
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'Failed to authorize');
  }

  return (await res.json()) as { code: string; expiresIn: number };
}

