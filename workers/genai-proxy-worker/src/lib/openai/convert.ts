import type { Env } from '../env';
import type {
  GoogleContent,
  GoogleGenerateContentRequest,
  GoogleGenerateContentResponse,
  GooglePart,
} from '../google/types';
import type {
  OpenAIChatRequest,
  OpenAIChatResponse,
  OpenAIMessage,
  OpenAIStreamChunk,
} from './types';

const MODEL_MAP: Record<string, string> = {
  'gemini-2.5-flash': 'gpt-4o-mini',
  'gemini-2.5-pro': 'gpt-4o',
  'gemini-2.0-flash': 'gpt-4o-mini',
  'gemini-1.5-pro': 'gpt-4o',
  'gemini-1.5-flash': 'gpt-4o-mini',
  'gemini-pro': 'gpt-4o-mini',
};

function resolveUpstreamModel(env: Env, googleModel: string): string {
  // For OpenAI-compatible non-OpenAI providers (e.g. DashScope), Gemini-style
  // model names are not meaningful. In phase 1 we default to env.DEFAULT_MODEL
  // unless PROVIDER explicitly indicates OpenAI.
  const isOpenAIProvider = env.PROVIDER === 'openai';
  if (!isOpenAIProvider) {
    return env.DEFAULT_MODEL || MODEL_MAP[googleModel] || 'gpt-4o-mini';
  }
  return MODEL_MAP[googleModel] || env.DEFAULT_MODEL || 'gpt-4o-mini';
}

export function convertGoogleToOpenAI(
  googleReq: GoogleGenerateContentRequest,
  googleModel: string,
  env: Env,
  stream: boolean,
): OpenAIChatRequest {
  const messages: OpenAIMessage[] = [];

  if (googleReq.systemInstruction) {
    const systemText = extractText(googleReq.systemInstruction);
    if (systemText) {
      messages.push({ role: 'system', content: systemText });
    }
  }

  for (const content of googleReq.contents || []) {
    const role = content.role === 'model' ? 'assistant' : 'user';
    for (const part of content.parts || []) {
      if (part.text) {
        messages.push({ role, content: part.text });
      } else if (part.functionResponse) {
        messages.push({
          role: 'tool',
          content: JSON.stringify(part.functionResponse.response),
          tool_call_id: part.functionResponse.id || part.functionResponse.name,
        });
      }
    }
  }

  const openaiRequest: OpenAIChatRequest = {
    model: resolveUpstreamModel(env, googleModel),
    messages,
    stream,
  };

  const config = googleReq.generationConfig;
  if (config) {
    if (config.temperature !== undefined) openaiRequest.temperature = config.temperature;
    if (config.maxOutputTokens !== undefined) openaiRequest.max_tokens = config.maxOutputTokens;
    if (config.topP !== undefined) openaiRequest.top_p = config.topP;
    if (config.stopSequences) openaiRequest.stop = config.stopSequences;
  }

  if (googleReq.tools?.length) {
    openaiRequest.tools = [];
    for (const tool of googleReq.tools) {
      if (tool.functionDeclarations) {
        for (const fn of tool.functionDeclarations) {
          openaiRequest.tools.push({
            type: 'function',
            function: {
              name: fn.name,
              description: fn.description,
              parameters: fn.parameters,
            },
          });
        }
      }
    }
  }

  return openaiRequest;
}

export function convertOpenAIToGoogle(
  openaiRes: OpenAIChatResponse,
): GoogleGenerateContentResponse {
  const choice = openaiRes.choices?.[0];
  const message = choice?.message;

  const parts: GooglePart[] = [];
  if (message?.content) {
    parts.push({ text: message.content });
  }

  if (message?.tool_calls) {
    for (const call of message.tool_calls) {
      if (call.type === 'function') {
        parts.push({
          functionCall: {
            name: call.function.name,
            args: safeJsonParse(call.function.arguments) ?? {},
          },
        });
      }
    }
  }

  return {
    candidates: [
      {
        content: { role: 'model', parts },
        finishReason: mapFinishReason(choice?.finish_reason),
      },
    ],
    usageMetadata: {
      promptTokenCount: openaiRes.usage?.prompt_tokens,
      candidatesTokenCount: openaiRes.usage?.completion_tokens,
      totalTokenCount: openaiRes.usage?.total_tokens,
    },
  };
}

export function convertOpenAIStreamChunkToGoogle(
  chunk: OpenAIStreamChunk,
): GoogleGenerateContentResponse {
  const delta = chunk.choices?.[0]?.delta;
  const parts: GooglePart[] = [];

  if (delta?.content) {
    parts.push({ text: delta.content });
  }

  // Best-effort: only emit functionCall if arguments is a valid JSON object.
  if (delta?.tool_calls) {
    for (const call of delta.tool_calls) {
      const fn = call.function;
      if (!fn?.name && !fn?.arguments) continue;
      const parsed = fn.arguments ? safeJsonParse(fn.arguments) : null;
      if (fn.name && parsed) {
        parts.push({
          functionCall: {
            name: fn.name,
            args: parsed,
          },
        });
      }
    }
  }

  return {
    candidates: [
      {
        content: { role: 'model', parts },
        finishReason: mapFinishReason(chunk.choices?.[0]?.finish_reason),
      },
    ],
  };
}

function extractText(content: GoogleContent | string): string {
  if (typeof content === 'string') return content;
  return content.parts?.map((p) => p.text).filter(Boolean).join('') || '';
}

function mapFinishReason(reason?: string): string {
  const map: Record<string, string> = {
    stop: 'STOP',
    length: 'MAX_TOKENS',
    tool_calls: 'TOOL_CALLS',
    content_filter: 'SAFETY',
  };
  return map[reason || ''] || 'STOP';
}

function safeJsonParse(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}
