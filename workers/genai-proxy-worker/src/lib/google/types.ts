export interface GoogleContent {
  role?: string;
  parts?: GooglePart[];
}

export interface GooglePart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { id?: string; name: string; response: unknown };
}

export interface GoogleGenerationConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
  responseMimeType?: string;
  responseSchema?: unknown;
  responseJsonSchema?: unknown;
  presencePenalty?: number;
  frequencyPenalty?: number;
  seed?: number;
}

export interface GoogleToolDeclaration {
  functionDeclarations?: Array<{
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  }>;
}

export interface GoogleGenerateContentConfig {
  systemInstruction?: GoogleContent | string;
  responseMimeType?: string;
  responseSchema?: unknown;
  responseJsonSchema?: unknown;
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
  presencePenalty?: number;
  frequencyPenalty?: number;
  seed?: number;
  tools?: GoogleToolDeclaration | GoogleToolDeclaration[];
}

export type GoogleContentsInput =
  | string
  | GooglePart
  | GooglePart[]
  | GoogleContent
  | GoogleContent[];

export interface GoogleGenerateContentRequestInput {
  contents?: GoogleContentsInput;
  systemInstruction?: GoogleContent | string;
  generationConfig?: GoogleGenerationConfig;
  tools?: GoogleToolDeclaration[];
  config?: GoogleGenerateContentConfig;
}

/**
 * Normalized Gemini-style request format that the proxy uses internally.
 * Incoming requests (e.g. `@google/genai` SDK parameters) should be normalized
 * into this shape before conversion.
 */
export interface GoogleGenerateContentRequest {
  contents?: GoogleContent[];
  systemInstruction?: GoogleContent | string;
  generationConfig?: GoogleGenerationConfig;
  tools?: GoogleToolDeclaration[];
}

export interface GoogleGenerateContentResponse {
  candidates?: Array<{
    content: GoogleContent;
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}
