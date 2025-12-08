import type { ApiWorkerEnv } from '../types/env';

interface AIResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string }>;
    };
  }>;
}

export interface ProjectMetadataSuggestion {
  name: string | null;
  category: string | null;
  tags: string[];
  description: string | null;
  slug: string | null;
}

const MARKETPLACE_CATEGORIES = [
  'Development',
  'Image Gen',
  'Productivity',
  'Marketing',
  'Legal',
  'Fun',
] as const;

const METADATA_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'AppMetadata',
    schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description:
            'Short, human-friendly product name (max 40 characters).',
        },
        category: {
          type: 'string',
          description: `One of: ${MARKETPLACE_CATEGORIES.join(', ')}`,
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Short, lowercase tags like ["chatbot", "landing-page", "analytics"].',
        },
        description: {
          type: 'string',
          description: 'Concise marketing-style summary (~120 chars).',
        },
        slug: {
          type: 'string',
          description:
            'Lowercase, URL-friendly identifier using only letters, numbers, and hyphens.',
        },
      },
      required: ['category'],
      additionalProperties: false,
    },
    strict: true,
  },
} as const;

const METADATA_SYSTEM_PROMPT =
  'You are a product manager helping categorize AI and web apps into a marketplace.\n' +
  'Respond with JSON only, containing fields "name", "category", "tags", "description" and "slug".\n' +
  '"name" must be <= 40 characters. "category" must be one of:\n' +
  MARKETPLACE_CATEGORIES.map((c) => `- ${c}`).join('\n') +
  '\n' +
  '"tags" must be an array of 1-5 short, lowercase keywords (no spaces).\n' +
  '"description" should explain the app in <= 120 characters.\n' +
  '"slug" must contain only lowercase letters, numbers, or hyphens.';

function buildMetadataUserPrompt(
  name: string,
  identifier: string,
  context?: string,
): string {
  const basePrompt =
    `App name: ${name}\n` +
    `Source identifier (repo URL or file name): ${identifier}\n`;
  const contextSection = context
    ? '\nAdditional context (snippets from deployed app):\n' +
      context +
      '\n'
    : '';
  return (
    basePrompt +
    contextSection +
    '\nBased on the intent, audience and typical use case, choose the best category from the list,\n' +
    'suggest tags that would help users discover this app, propose a friendly name/description,\n' +
    'and provide a concise slug (letters, numbers, hyphens) suitable for URLs.'
  );
}

function extractTextFromAIResponse(data: AIResponse): string | null {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (typeof part?.text === 'string') return part.text;
        return '';
      })
      .join('');
  }
  if (content === undefined || content === null) {
    return null;
  }
  return JSON.stringify(content);
}

function normalizeSlugCandidate(value?: string | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  if (/^[a-z0-9-]{1,64}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

function emptySuggestion(): ProjectMetadataSuggestion {
  return {
    name: null,
    category: null,
    tags: [],
    description: null,
    slug: null,
  };
}

class AIService {
  isEnabled(env: ApiWorkerEnv): boolean {
    const apiKey = env.DASHSCOPE_API_KEY?.trim() || '';
    return apiKey.length > 0;
  }

  async generateProjectMetadata(
    env: ApiWorkerEnv,
    name: string,
    identifier: string,
    context?: string,
  ): Promise<ProjectMetadataSuggestion> {
    if (!this.isEnabled(env)) {
      return emptySuggestion();
    }

    const baseUrl =
      env.PLATFORM_AI_BASE_URL ??
      'https://dashscope.aliyuncs.com/compatible-mode/v1';
    const model = env.PLATFORM_AI_MODEL ?? 'qwen3-max';
    const apiKey = env.DASHSCOPE_API_KEY ?? '';

    const body = {
      model,
      messages: [
        { role: 'system', content: METADATA_SYSTEM_PROMPT },
        {
          role: 'user',
          content: buildMetadataUserPrompt(name, identifier, context),
        },
      ],
      response_format: METADATA_RESPONSE_FORMAT,
    };

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error(
          'AI metadata generation failed:',
          response.status,
          response.statusText,
          errorText,
        );
        return emptySuggestion();
      }

      const data: AIResponse = await response.json();
      const text = extractTextFromAIResponse(data);
      if (!text) {
        return emptySuggestion();
      }

      let parsed: ProjectMetadataSuggestion;
      try {
        parsed = JSON.parse(text) as ProjectMetadataSuggestion;
      } catch (err) {
        console.error('Failed to parse AI metadata JSON:', err, 'raw:', text);
        return emptySuggestion();
      }

      const nameResult =
        typeof parsed.name === 'string' && parsed.name.trim().length > 0
          ? parsed.name.trim()
          : null;
      const descriptionResult =
        typeof parsed.description === 'string' &&
        parsed.description.trim().length > 0
          ? parsed.description.trim()
          : null;
      const categoryResult =
        typeof parsed.category === 'string' ? parsed.category : null;
      const tagsResult = Array.isArray(parsed.tags)
        ? parsed.tags
            .filter((tag): tag is string => typeof tag === 'string')
            .map((tag) => tag.trim().toLowerCase())
            .filter((tag) => tag.length > 0)
            .slice(0, 5)
        : [];
      const slugResult = normalizeSlugCandidate(parsed.slug);

      return {
        name: nameResult,
        category: categoryResult,
        tags: tagsResult,
        description: descriptionResult,
        slug: slugResult,
      };
    } catch (err) {
      console.error('Error calling AI metadata generator:', err);
      return emptySuggestion();
    }
  }
}

export const aiService = new AIService();
