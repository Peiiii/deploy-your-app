import type {
  GoogleContent,
  GoogleGenerateContentRequest,
  GoogleGenerationConfig,
  GooglePart,
  GoogleToolDeclaration,
} from './types';

type UnknownRecord = Record<string, unknown>;

export function normalizeGenerateContentRequest(
  input: unknown,
): { value: GoogleGenerateContentRequest; error: string | null } {
  if (!isPlainObject(input)) {
    return { value: {}, error: 'Request body must be a JSON object.' };
  }

  const req = input as UnknownRecord;
  const config = isPlainObject(req.config) ? (req.config as UnknownRecord) : undefined;

  const contents = normalizeContents(req.contents);

  const systemInstruction = mergeSystemInstruction(
    req.systemInstruction,
    config?.systemInstruction,
  );

  const generationConfig = mergeGenerationConfig(req.generationConfig, config);
  const tools = mergeTools(req.tools, config?.tools);

  const normalized: GoogleGenerateContentRequest = {
    contents,
    systemInstruction,
    generationConfig,
    tools,
  };

  if (!normalized.contents?.length && !normalized.systemInstruction) {
    return {
      value: normalized,
      error: 'Missing `contents`: provide a prompt string or Gemini-style contents array.',
    };
  }

  return { value: normalized, error: null };
}

function normalizeContents(input: unknown): GoogleContent[] | undefined {
  if (input === undefined || input === null) return undefined;

  if (typeof input === 'string') {
    return [userTextContent(input)];
  }

  if (Array.isArray(input)) {
    if (input.length === 0) return [];

    const hasContentShape = input.some((item) => isPlainObject(item) && ('parts' in item || 'role' in item));
    if (hasContentShape) {
      return input
        .filter((item) => isPlainObject(item))
        .map((item) => normalizeContent(item as UnknownRecord));
    }

    // Treat as `PartUnion[]` from `@google/genai` (strings and/or part objects).
    const parts = input
      .map((part) => normalizePart(part))
      .filter((part): part is GooglePart => Boolean(part));
    return parts.length ? [{ role: 'user', parts }] : undefined;
  }

  if (isPlainObject(input)) {
    if ('parts' in input || 'role' in input) {
      return [normalizeContent(input)];
    }

    const part = normalizePart(input);
    if (part) return [{ role: 'user', parts: [part] }];
  }

  return undefined;
}

function normalizeContent(input: UnknownRecord): GoogleContent {
  const role = typeof input.role === 'string' ? input.role : undefined;
  const partsInput = input.parts;
  const parts = Array.isArray(partsInput)
    ? partsInput
        .map((p) => normalizePart(p))
        .filter((p): p is GooglePart => Boolean(p))
    : undefined;
  return { role, parts };
}

function normalizePart(input: unknown): GooglePart | null {
  if (typeof input === 'string') return { text: input };
  if (!isPlainObject(input)) return null;

  // Keep only fields that this Phase-1 proxy understands.
  if (typeof input.text === 'string') return { text: input.text };

  const functionResponse = input.functionResponse;
  if (isPlainObject(functionResponse) && typeof functionResponse.name === 'string') {
    const id = typeof functionResponse.id === 'string' ? functionResponse.id : undefined;
    return {
      functionResponse: {
        id,
        name: functionResponse.name,
        response: functionResponse.response,
      },
    };
  }

  const functionCall = input.functionCall;
  if (isPlainObject(functionCall) && typeof functionCall.name === 'string') {
    const args = isPlainObject(functionCall.args) ? (functionCall.args as Record<string, unknown>) : {};
    return { functionCall: { name: functionCall.name, args } };
  }

  return null;
}

function mergeSystemInstruction(
  a: unknown,
  b: unknown,
): GoogleContent | string | undefined {
  const aText = extractSystemText(a);
  const bText = extractSystemText(b);

  if (!aText && !bText) return undefined;
  if (aText && !bText) return aText;
  if (!aText && bText) return bText;

  return `${aText}\n\n${bText}`;
}

function mergeGenerationConfig(
  generationConfigInput: unknown,
  configInput?: UnknownRecord,
): GoogleGenerationConfig | undefined {
  const base = isPlainObject(generationConfigInput)
    ? (generationConfigInput as GoogleGenerationConfig)
    : undefined;

  const fromConfig = configInput ? pickGenerationConfigFromConfig(configInput) : undefined;

  if (!base && !fromConfig) return undefined;
  return { ...(base || {}), ...(fromConfig || {}) };
}

function pickGenerationConfigFromConfig(config: UnknownRecord): GoogleGenerationConfig | undefined {
  const out: GoogleGenerationConfig = {};

  if (typeof config.temperature === 'number') out.temperature = config.temperature;
  if (typeof config.topP === 'number') out.topP = config.topP;
  if (typeof config.topK === 'number') out.topK = config.topK;
  if (typeof config.maxOutputTokens === 'number') out.maxOutputTokens = config.maxOutputTokens;
  if (Array.isArray(config.stopSequences)) out.stopSequences = config.stopSequences.filter((s) => typeof s === 'string');

  if (typeof config.responseMimeType === 'string') out.responseMimeType = config.responseMimeType;
  if (config.responseSchema !== undefined) out.responseSchema = config.responseSchema;
  if (config.responseJsonSchema !== undefined) out.responseJsonSchema = config.responseJsonSchema;

  if (typeof config.presencePenalty === 'number') out.presencePenalty = config.presencePenalty;
  if (typeof config.frequencyPenalty === 'number') out.frequencyPenalty = config.frequencyPenalty;
  if (typeof config.seed === 'number') out.seed = config.seed;

  return Object.keys(out).length ? out : undefined;
}

function mergeTools(
  toolsInput: unknown,
  configToolsInput: unknown,
): GoogleToolDeclaration[] | undefined {
  const a = normalizeTools(toolsInput);
  const b = normalizeTools(configToolsInput);
  if (!a?.length && !b?.length) return undefined;
  return [...(a || []), ...(b || [])];
}

function normalizeTools(input: unknown): GoogleToolDeclaration[] | undefined {
  if (!input) return undefined;
  if (Array.isArray(input)) {
    return input.filter((t) => isPlainObject(t)) as GoogleToolDeclaration[];
  }
  if (isPlainObject(input)) {
    return [input as GoogleToolDeclaration];
  }
  return undefined;
}

function userTextContent(text: string): GoogleContent {
  return { role: 'user', parts: [{ text }] };
}

function extractSystemText(input: unknown): string {
  if (!input) return '';
  if (typeof input === 'string') return input;
  if (!isPlainObject(input)) return '';

  const parts = input.parts;
  if (!Array.isArray(parts)) return '';

  return parts
    .map((p) => (isPlainObject(p) && typeof p.text === 'string' ? p.text : ''))
    .filter(Boolean)
    .join('');
}

function isPlainObject(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
