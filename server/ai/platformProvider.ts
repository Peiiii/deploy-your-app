import { PLATFORM_AI_PROVIDER, PLATFORM_AI_MODEL, DASHSCOPE_API_KEY } from '../config.js';

export interface PlatformAIAnalyzeParams {
  sourceCode: string;
}

export interface PlatformAIAnalyzeResult {
  refactoredCode: string;
  explanation: string;
}

export interface PlatformAIProvider {
  analyzeUserCode(params: PlatformAIAnalyzeParams): Promise<PlatformAIAnalyzeResult>;
}

class NoopPlatformProvider implements PlatformAIProvider {
  async analyzeUserCode({ sourceCode }: PlatformAIAnalyzeParams): Promise<PlatformAIAnalyzeResult> {
    return {
      refactoredCode: sourceCode,
      explanation:
        'Platform AI is not configured. Returning your original code without changes.',
    };
  }
}

class DashScopePlatformProvider implements PlatformAIProvider {
  private baseUrl: string;
  private model: string;
  private apiKey: string;

  constructor() {
    this.baseUrl =
      process.env.PLATFORM_AI_BASE_URL ||
      'https://dashscope.aliyuncs.com/compatible-mode/v1';
    this.model = PLATFORM_AI_MODEL;
    this.apiKey = DASHSCOPE_API_KEY;
  }

  async analyzeUserCode({ sourceCode }: PlatformAIAnalyzeParams): Promise<PlatformAIAnalyzeResult> {
    if (!this.apiKey) {
      // Fail soft: keep product可用，即使平台 AI 未配置。
      return {
        refactoredCode: sourceCode,
        explanation:
          'DashScope API key is not configured on the server. Returning original code.',
      };
    }

    const systemPrompt =
      'You are a senior frontend and security engineer. ' +
      'You receive user application code that uses AI SDKs (for example Google Gemini, OpenAI, or other providers). ' +
      'Your task is to rewrite this code so that it calls a backend or proxy entrypoint instead of using API keys directly in the browser. ' +
      'You must output ONLY a JSON object with fields "refactoredCode" and "explanation". ' +
      'Do not include markdown or commentary outside of JSON.';

    const userPrompt =
      'Here is the user source code that initializes an AI SDK or sends requests:\n\n' +
      sourceCode +
      '\n\n' +
      'Requirements:\n' +
      '1. Remove any direct usage of secret API keys in the browser.\n' +
      '2. If the code currently calls a specific provider (Gemini/OpenAI/etc), keep the overall structure but assume the actual key and endpoint will be injected from a secure proxy on the backend.\n' +
      '3. Keep the code as close as possible to the original style, only changing what is necessary for security and configurability.\n' +
      '4. Return JSON with:\n' +
      '   - refactoredCode: full updated source code as a string\n' +
      '   - explanation: short explanation of what you changed and why\n';

    const body = {
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'SecureRefactorResult',
          schema: {
            type: 'object',
            properties: {
              refactoredCode: {
                type: 'string',
                description:
                  'The modified source code using a backend/proxy instead of direct API key usage.',
              },
              explanation: {
                type: 'string',
                description:
                  'Short explanation of what was changed for security and provider decoupling.',
              },
            },
            required: ['refactoredCode', 'explanation'],
            additionalProperties: false,
          },
          strict: true,
        },
      },
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(
        `DashScope analyze failed: ${response.status} ${response.statusText} ${errorText}`,
      );
    }

    const data: unknown = await response.json();

    const choice = (data as { choices?: Array<{ message?: unknown }> }).choices?.[0];
    const message = choice?.message as { content?: unknown } | undefined;
    if (!message) {
      throw new Error('DashScope response missing choices[0].message');
    }

    const content = message?.content as unknown;
    let text: string;
    if (typeof content === 'string') {
      text = content;
    } else if (Array.isArray(content)) {
      // Some providers return an array of content parts.
      text = content
        .map((part) => {
          if (typeof part === 'string') return part;
          if (typeof part?.text === 'string') return part.text;
          return '';
        })
        .join('');
    } else {
      text = JSON.stringify(content);
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      throw new Error(`Failed to parse DashScope JSON response: ${String(err)}; raw=${text}`);
    }

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof parsed.refactoredCode !== 'string' ||
      typeof parsed.explanation !== 'string'
    ) {
      throw new Error('DashScope JSON does not contain required fields refactoredCode/explanation');
    }

    return {
      refactoredCode: parsed.refactoredCode,
      explanation: parsed.explanation,
    };
  }
}

export function createPlatformAIProvider() {
  if (PLATFORM_AI_PROVIDER === 'dashscope') {
    return new DashScopePlatformProvider();
  }

  // 默认退化为 no-op，后端依然可用，只是不给智能改写。
  return new NoopPlatformProvider();
}
