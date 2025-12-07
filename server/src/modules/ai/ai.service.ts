import {
  DASHSCOPE_API_KEY,
  PLATFORM_AI_MODEL,
  PLATFORM_AI_BASE_URL,
} from '../../common/config/config.js';

// Type definitions
interface AIResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string }>;
    };
  }>;
}

export type ProjectCategory =
  | 'Development'
  | 'Image Gen'
  | 'Productivity'
  | 'Marketing'
  | 'Legal'
  | 'Fun';

const MARKETPLACE_CATEGORIES: ProjectCategory[] = [
  'Development',
  'Image Gen',
  'Productivity',
  'Marketing',
  'Legal',
  'Fun',
];

interface ParsedCategory {
  category?: string;
}

interface ParsedCategoryAndTags extends ParsedCategory {
  name?: string;
  tags?: string[];
  description?: string;
  slug?: string;
}

export interface ProjectMetadataSuggestion {
  name: string | null;
  category: ProjectCategory | null;
  tags: string[];
  description: string | null;
  slug: string | null;
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

function emptyMetadataSuggestion(): ProjectMetadataSuggestion {
  return {
    name: null,
    category: null,
    tags: [],
    description: null,
    slug: null,
  };
}

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

function normalizeSlugCandidate(value?: string | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  if (/^[a-z0-9-]{1,64}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

/**
 * AI Service for various AI-powered features
 * This service is designed to be extensible for future AI capabilities
 */
export class AIService {
  private baseUrl: string;
  private model: string;
  private apiKey: string | undefined;

  constructor() {
    this.baseUrl = PLATFORM_AI_BASE_URL;
    this.model = PLATFORM_AI_MODEL;
    this.apiKey = DASHSCOPE_API_KEY;
  }

  /**
   * Classify a project into a category using AI
   * @param name - Project name
   * @param identifier - Source identifier (repo URL or file name)
   * @returns Category string or null if classification fails
   */
  async classifyProjectCategory(
    name: string,
    identifier: string,
  ): Promise<ProjectCategory | null> {
    if (!this.apiKey) {
      return null;
    }

    const systemPrompt =
      'You are a product manager helping categorize AI and web apps into marketplace categories.\n' +
      'You MUST respond with JSON only, with a single field "category".\n' +
      'The value MUST be exactly one of the following strings:\n' +
      MARKETPLACE_CATEGORIES.map((c) => `- ${c}`).join('\n');

    const userPrompt =
      `App name: ${name}\n` +
      `Source identifier (repo URL or file name): ${identifier}\n\n` +
      'Based on the intent, audience and typical use case, choose the best category from the list.';

    const body = {
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'AppCategory',
          schema: {
            type: 'object',
            properties: {
              category: {
                type: 'string',
                description:
                  'One of: Development, Image Gen, Productivity, Marketing, Legal, Fun',
              },
            },
            required: ['category'],
            additionalProperties: false,
          },
          strict: true,
        },
      },
    };

    try {
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
        console.error(
          'AI category classification failed:',
          response.status,
          response.statusText,
          errorText,
        );
        return null;
      }

      const data: AIResponse = await response.json();
      const text = extractTextFromAIResponse(data);
      if (!text) {
        return null;
      }

      let parsed: ParsedCategory;
      try {
        parsed = JSON.parse(text) as ParsedCategory;
      } catch (err) {
        console.error('Failed to parse AI category JSON:', err, 'raw:', text);
        return null;
      }

      const rawCategory = parsed?.category;
      if (typeof rawCategory !== 'string') return null;

      const normalized = rawCategory.trim().toLowerCase();
      const match = MARKETPLACE_CATEGORIES.find(
        (c) => c.toLowerCase() === normalized,
      );
      return match ?? null;
    } catch (err) {
      console.error('Error calling AI category classifier:', err);
      return null;
    }
  }

  /**
   * Classify project category and suggest tags using a single AI call.
   * Additionally, this can suggest a nicer display name and a short
   * marketing-style description for the Explore page.
   *
   * This is used by the backend when creating a new project so that
   * Explore Apps has both a stable category, richer tags and a
   * human-friendly summary.
   */
  /**
   * Aggregate request that asks the platform AI to suggest nicer metadata
   * for an uploaded project. The response may include:
   *   - human friendly display name
   *   - marketplace category + tags
   *   - short marketing-style description
   *   - a stable, URL-friendly slug
   *
   * This keeps the caller interface simple and lets the prompt evolve
   * without touching every call site.
   */
  async generateProjectMetadata(
    name: string,
    identifier: string,
    context?: string,
  ): Promise<ProjectMetadataSuggestion> {
    if (!this.apiKey) {
      return emptyMetadataSuggestion();
    }

    const body = {
      model: this.model,
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
        console.error(
          'AI metadata generation failed:',
          response.status,
          response.statusText,
          errorText,
        );
        return emptyMetadataSuggestion();
      }

      const data: AIResponse = await response.json();
      const text = extractTextFromAIResponse(data);
      if (!text) {
        return emptyMetadataSuggestion();
      }

      let parsed: ParsedCategoryAndTags;
      try {
        parsed = JSON.parse(text) as ParsedCategoryAndTags;
      } catch (err) {
        console.error(
          'Failed to parse AI category+tags+metadata JSON:',
          err,
          'raw:',
          text,
        );
        return emptyMetadataSuggestion();
      }

      let nameResult: string | null = null;
      if (typeof parsed.name === 'string') {
        const trimmed = parsed.name.trim();
        if (trimmed.length > 0 && trimmed.length <= 80) {
          nameResult = trimmed;
        }
      }

      const rawCategory = parsed?.category;
      let category: ProjectCategory | null = null;
      if (typeof rawCategory === 'string') {
        const normalized = rawCategory.trim().toLowerCase();
        const match = MARKETPLACE_CATEGORIES.find(
          (c) => c.toLowerCase() === normalized,
        );
        category = match ?? null;
      }

      let tags: string[] = [];
      if (Array.isArray(parsed?.tags)) {
        tags = parsed.tags
          .filter((t) => typeof t === 'string')
          .map((t) => t.trim().toLowerCase())
          .filter((t) => t.length > 0)
          .slice(0, 5);
      }

      let description: string | null = null;
      if (typeof parsed.description === 'string') {
        const trimmed = parsed.description.trim();
        if (trimmed.length > 0 && trimmed.length <= 300) {
          description = trimmed;
        }
      }

      const slug = normalizeSlugCandidate(parsed.slug);

      return { name: nameResult, category, tags, description, slug };
    } catch (err) {
      console.error('Error calling AI metadata generator:', err);
      return emptyMetadataSuggestion();
    }
  }

  // Future AI capabilities can be added here, for example:
  // async generateProjectDescription(name: string, code: string): Promise<string | null>
  // async analyzeProjectComplexity(code: string): Promise<ComplexityScore | null>
}

// Singleton instance
let aiServiceInstance: AIService | null = null;

/**
 * Get the singleton AI service instance
 */
export function getAIService(): AIService {
  if (!aiServiceInstance) {
    aiServiceInstance = new AIService();
  }
  return aiServiceInstance;
}
