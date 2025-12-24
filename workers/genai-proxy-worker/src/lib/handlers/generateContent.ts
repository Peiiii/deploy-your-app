import { errorResponse } from '@deploy-your-app/worker-kit';
import { getChatCompletionsUrl, getUpstreamApiKeyOrThrow, type Env } from '../env';
import { normalizeGenerateContentRequest } from '../google/normalize';
import { validateTextOnlyRequest } from '../validate';
import type { OpenAIChatRequest, OpenAIChatResponse, OpenAIStreamChunk } from '../openai/types';
import {
  convertGoogleToOpenAI,
  convertOpenAIStreamChunkToGoogle,
  convertOpenAIToGoogle,
} from '../openai/convert';

export async function handleGenerateContent(
  request: Request,
  env: Env,
  opts: { stream: boolean },
): Promise<Response> {
  const normalizeResult = normalizeGenerateContentRequest(await request.json());
  if (normalizeResult.error) {
    return errorResponse(400, normalizeResult.error);
  }
  const googleRequest = normalizeResult.value;

  const validationError = validateTextOnlyRequest(googleRequest);
  if (validationError) {
    return errorResponse(400, validationError);
  }

  const url = new URL(request.url);
  const modelMatch = url.pathname.match(/\/models\/([^:]+)/);
  const googleModel = modelMatch?.[1] || 'gemini-2.0-flash';

  // @google/genai requires an apiKey and sends it via x-goog-api-key by default,
  // but Phase 1 does NOT use client-provided keys for upstream calls.
  // const clientToken = request.headers.get('x-goog-api-key');

  const upstreamApiKey = getUpstreamApiKeyOrThrow(env);

  const openaiRequest = convertGoogleToOpenAI(
    googleRequest,
    googleModel,
    env,
    opts.stream,
  );

  const targetUrl = getChatCompletionsUrl(env);

  const upstreamResponse = await fetchWithResponseFormatFallback(
    targetUrl,
    upstreamApiKey,
    openaiRequest,
  );

  if (!upstreamResponse.ok) {
    const text = await upstreamResponse.text();
    return errorResponse(
      upstreamResponse.status,
      `Upstream API error: ${truncate(text, 2000)}`,
    );
  }

  if (!opts.stream) {
    const openaiResponse = (await upstreamResponse.json()) as OpenAIChatResponse;
    const googleResponse = convertOpenAIToGoogle(openaiResponse);
    return new Response(JSON.stringify(googleResponse), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const responseBody = upstreamResponse.body;
  if (!responseBody) {
    return errorResponse(500, 'Upstream response has no body');
  }

  const reader = responseBody.getReader();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data:')) continue;

            const data = line.slice(5).trim();
            if (!data || data === '[DONE]') continue;

            const parsed = safeJsonParseChunk(data);
            if (!parsed) continue;

            const googleChunk = convertOpenAIStreamChunkToGoogle(parsed);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(googleChunk)}\n\n`),
            );
          }
        }
      } finally {
        reader.releaseLock();
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

async function fetchWithResponseFormatFallback(
  targetUrl: string,
  upstreamApiKey: string,
  openaiRequest: OpenAIChatRequest,
): Promise<Response> {
  const doFetch = (body: OpenAIChatRequest) =>
    fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${upstreamApiKey}`,
      },
      body: JSON.stringify(body),
    });

  const res = await doFetch(openaiRequest);
  if (res.ok) return res;

  if (!openaiRequest.response_format) return res;

  // Some OpenAI-compatible providers reject `response_format`. Retry once without it.
  if (!shouldRetryWithoutResponseFormat(res.status, await res.clone().text())) {
    return res;
  }

  const { response_format, ...rest } = openaiRequest;
  void response_format;
  return doFetch(rest);
}

function shouldRetryWithoutResponseFormat(status: number, bodyText: string): boolean {
  if (status < 400 || status >= 500) return false;
  const text = bodyText.toLowerCase();
  return (
    text.includes('response_format') ||
    text.includes('json_schema') ||
    text.includes('unknown field') ||
    text.includes('unexpected') ||
    text.includes('not allowed')
  );
}

function safeJsonParseChunk(value: string): OpenAIStreamChunk | null {
  try {
    return JSON.parse(value) as OpenAIStreamChunk;
  } catch {
    return null;
  }
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}
