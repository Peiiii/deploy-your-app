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
  OpenAIResponseFormat,
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
    if (config.presencePenalty !== undefined) openaiRequest.presence_penalty = config.presencePenalty;
    if (config.frequencyPenalty !== undefined) openaiRequest.frequency_penalty = config.frequencyPenalty;
    if (config.seed !== undefined) openaiRequest.seed = config.seed;

    const responseFormat = resolveResponseFormat(config);
    if (responseFormat) {
      openaiRequest.response_format = responseFormat;
      ensureJsonOnlyInstruction(openaiRequest.messages, responseFormat);
      ensureSchemaKeyInstruction(openaiRequest.messages, responseFormat);
    }
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
  const structuredJson = extractStructuredOutputJson(message);
  if (structuredJson) {
    parts.push({ text: structuredJson });
  } else if (message?.content) {
    parts.push({ text: message.content });
  }

  if (message?.tool_calls) {
    for (const call of message.tool_calls) {
      if (call.type === 'function') {
        if (call.function.name === '__structured_output') continue;
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

function resolveResponseFormat(
  config: NonNullable<GoogleGenerateContentRequest['generationConfig']>,
): OpenAIResponseFormat | null {
  const mime = config.responseMimeType;
  if (mime !== 'application/json') return null;

  const schemaCandidate = config.responseJsonSchema ?? config.responseSchema;
  if (schemaCandidate && isPlainObject(schemaCandidate)) {
    const schema = normalizeSchemaLikeToJsonSchema(schemaCandidate);
    return {
      type: 'json_schema',
      json_schema: { name: 'response', schema, strict: true },
    };
  }

  return { type: 'json_object' };
}

function ensureJsonOnlyInstruction(
  messages: OpenAIMessage[],
  responseFormat: OpenAIResponseFormat,
): void {
  const base =
    responseFormat.type === 'json_schema'
      ? 'Return ONLY valid JSON that matches the provided JSON Schema. Do not include markdown fences.'
      : 'Return ONLY valid JSON. Do not include markdown fences.';

  const systemIndex = messages.findIndex((m) => m.role === 'system');
  if (systemIndex === -1) {
    messages.unshift({ role: 'system', content: base });
    return;
  }
  const existing = messages[systemIndex]?.content || '';
  if (existing.includes('Return ONLY valid JSON')) return;
  messages[systemIndex] = { role: 'system', content: `${existing}\n\n${base}`.trim() };
}

function ensureSchemaKeyInstruction(
  messages: OpenAIMessage[],
  responseFormat: OpenAIResponseFormat,
): void {
  if (responseFormat.type !== 'json_schema') return;
  const schema = responseFormat.json_schema.schema;

  const keyHint = buildKeyHintFromJsonSchema(schema);
  if (!keyHint) return;

  const systemIndex = messages.findIndex((m) => m.role === 'system');
  const addition = `JSON MUST include the following required keys:\n${keyHint}`;

  if (systemIndex === -1) {
    messages.unshift({ role: 'system', content: addition });
    return;
  }

  const existing = messages[systemIndex]?.content || '';
  if (existing.includes('JSON MUST include the following required keys:')) return;
  messages[systemIndex] = { role: 'system', content: `${existing}\n\n${addition}`.trim() };
}

function buildKeyHintFromJsonSchema(schema: Record<string, unknown>): string {
  const type = schema.type;
  if (type !== 'object') return '';

  const required = Array.isArray(schema.required)
    ? schema.required.filter((k) => typeof k === 'string')
    : [];

  const properties = isPlainObject(schema.properties)
    ? (schema.properties as Record<string, unknown>)
    : {};

  if (!required.length) return '';

  const lines: string[] = [];
  for (const key of required.slice(0, 20)) {
    const prop = properties[key];
    const hint = describeSchemaKey(prop, 2);
    lines.push(hint ? `- ${key}: ${hint}` : `- ${key}`);
  }

  if (required.length > 20) {
    lines.push(`- ... (${required.length - 20} more)`);
  }

  return lines.join('\n');
}

function describeSchemaKey(schema: unknown, depthLeft: number): string {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return '';

  const s = schema as Record<string, unknown>;
  const type = s.type;

  if (type === 'string' || type === 'number' || type === 'integer' || type === 'boolean') {
    return String(type);
  }

  if (type === 'array') {
    const itemHint = depthLeft > 0 ? describeSchemaKey(s.items, depthLeft - 1) : '';
    return itemHint ? `array<${itemHint}>` : 'array';
  }

  if (type === 'object') {
    if (depthLeft <= 0) return 'object';
    const required = Array.isArray(s.required)
      ? s.required.filter((k) => typeof k === 'string').slice(0, 10)
      : [];
    if (!required.length) return 'object';
    return `object{required: ${required.join(', ')}}`;
  }

  return '';
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

function extractStructuredOutputJson(
  message:
    | {
        tool_calls?: Array<{
          type: string;
          function: { name: string; arguments: string };
        }>;
      }
    | undefined,
): string {
  const calls = message?.tool_calls;
  if (!calls?.length) return '';

  for (const call of calls) {
    if (call.type !== 'function') continue;
    if (call.function.name !== '__structured_output') continue;

    const raw = call.function.arguments;
    if (typeof raw !== 'string' || raw.length === 0) return '';

    // Best-effort parse; fall back to raw string if it's already JSON text.
    try {
      const parsed = JSON.parse(raw) as unknown;
      return JSON.stringify(parsed);
    } catch {
      return raw;
    }
  }

  return '';
}

function normalizeSchemaLikeToJsonSchema(schemaLike: Record<string, unknown>): Record<string, unknown> {
  const normalized = normalizeJsonSchemaValue(schemaLike);
  return isPlainObject(normalized) ? normalized : {};
}

function normalizeJsonSchemaValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeJsonSchemaValue);
  }

  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      if (key === 'type') {
        out.type = normalizeSchemaTypeValue(v);
        continue;
      }
      out[key] = normalizeJsonSchemaValue(v);
    }
    return out;
  }

  return value;
}

function normalizeSchemaTypeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === 'string' ? normalizeSchemaTypeString(v) : v));
  }
  if (typeof value === 'string') return normalizeSchemaTypeString(value);
  return value;
}

function normalizeSchemaTypeString(value: string): string {
  const t = value.toLowerCase();
  if (value === 'OBJECT') return 'object';
  if (value === 'ARRAY') return 'array';
  if (value === 'STRING') return 'string';
  if (value === 'NUMBER') return 'number';
  if (value === 'INTEGER') return 'integer';
  if (value === 'BOOLEAN') return 'boolean';
  return t;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
