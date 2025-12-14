export interface GoogleContent {
  role?: string;
  parts?: GooglePart[];
}

export interface GooglePart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { id?: string; name: string; response: unknown };
}

export interface GoogleGenerateContentRequest {
  contents?: GoogleContent[];
  systemInstruction?: GoogleContent | string;
  generationConfig?: {
    temperature?: number;
    topP?: number;
    topK?: number;
    maxOutputTokens?: number;
    stopSequences?: string[];
  };
  tools?: Array<{
    functionDeclarations?: Array<{
      name: string;
      description?: string;
      parameters?: Record<string, unknown>;
    }>;
  }>;
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

