import { errorResponse } from '@deploy-your-app/worker-kit';
import type { Env } from '../env';
import { getChatCompletionsUrl, getUpstreamApiKeyOrThrow } from '../env';

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function handleChatCompletions(req: Request, env: Env): Promise<Response> {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return errorResponse(400, 'Invalid JSON body');
  }

  if (!isJsonObject(payload)) {
    return errorResponse(400, 'Invalid request body');
  }

  if (typeof payload.model !== 'string' || payload.model.trim().length === 0) {
    payload.model = env.DEFAULT_MODEL;
  }

  const upstreamUrl = getChatCompletionsUrl(env);
  const upstreamReq = new Request(upstreamUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // Phase 1: ignore client auth headers; always use the Worker secret.
      authorization: `Bearer ${getUpstreamApiKeyOrThrow(env)}`,
      accept: req.headers.get('accept') || 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const upstreamRes = await fetch(upstreamReq);

  const headers = new Headers(upstreamRes.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');

  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    headers,
  });
}

