import {
  DASHSCOPE_API_KEY,
  PLATFORM_AI_MODEL,
  PLATFORM_AI_BASE_URL,
} from '../config.js';

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

interface ParsedCategory {
  category?: string;
}

interface ParsedCategoryAndTags extends ParsedCategory {
  tags?: string[];
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

    const allowedCategories: ProjectCategory[] = [
      'Development',
      'Image Gen',
      'Productivity',
      'Marketing',
      'Legal',
      'Fun',
    ];

    const systemPrompt =
      'You are a product manager helping categorize AI and web apps into marketplace categories.\n' +
      'You MUST respond with JSON only, with a single field "category".\n' +
      'The value MUST be exactly one of the following strings:\n' +
      allowedCategories.map((c) => `- ${c}`).join('\n');

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
      const choice = data?.choices?.[0];
      const msg = choice?.message;
      const content = msg?.content;

      let text: string;
      if (typeof content === 'string') {
        text = content;
      } else if (Array.isArray(content)) {
        text = content
          .map((part) => {
            if (typeof part === 'string') return part;
            if (typeof part?.text === 'string') return part.text;
            return '';
          })
          .join('');
      } else {
        text = JSON.stringify(content ?? '');
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
      const match = allowedCategories.find(
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
   * This is used by the backend when creating a new project so that
   * Explore Apps has both a stable category and richer tags.
   */
  async classifyProjectCategoryAndTags(
    name: string,
    identifier: string,
    context?: string,
  ): Promise<{ category: ProjectCategory | null; tags: string[] }> {
    if (!this.apiKey) {
      return { category: null, tags: [] };
    }

    const allowedCategories: ProjectCategory[] = [
      'Development',
      'Image Gen',
      'Productivity',
      'Marketing',
      'Legal',
      'Fun',
    ];

    const systemPrompt =
      'You are a product manager helping categorize AI and web apps into marketplace categories.\n' +
      'You MUST respond with JSON only, with fields "category" and "tags".\n' +
      'The "category" value MUST be exactly one of the following strings:\n' +
      allowedCategories.map((c) => `- ${c}`).join('\n') +
      '\n' +
      'The "tags" field MUST be an array of 1-5 short, lowercase keywords (no spaces),\n' +
      'for example ["chatbot", "landing-page", "analytics"].';

    const basePrompt =
      `App name: ${name}\n` +
      `Source identifier (repo URL or file name): ${identifier}\n`;

    const contextSection = context
      ? '\nAdditional context from the deployed app (may be partial, do not echo verbatim):\n' +
        context +
        '\n'
      : '';

    const userPrompt =
      basePrompt +
      contextSection +
      '\nBased on the intent, audience and typical use case, choose the best category from the list\n' +
      'and suggest tags that would help users discover this app.';

    const body = {
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'AppCategoryAndTags',
          schema: {
            type: 'object',
            properties: {
              category: {
                type: 'string',
                description:
                  'One of: Development, Image Gen, Productivity, Marketing, Legal, Fun',
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description:
                  'Short, lowercase tags like ["chatbot", "landing-page", "analytics"].',
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
          'AI category+tags classification failed:',
          response.status,
          response.statusText,
          errorText,
        );
        return { category: null, tags: [] };
      }

      const data: AIResponse = await response.json();
      const choice = data?.choices?.[0];
      const msg = choice?.message;
      const content = msg?.content;

      let text: string;
      if (typeof content === 'string') {
        text = content;
      } else if (Array.isArray(content)) {
        text = content
          .map((part) => {
            if (typeof part === 'string') return part;
            if (typeof part?.text === 'string') return part.text;
            return '';
          })
          .join('');
      } else {
        text = JSON.stringify(content ?? '');
      }

      let parsed: ParsedCategoryAndTags;
      try {
        parsed = JSON.parse(text) as ParsedCategoryAndTags;
      } catch (err) {
        console.error('Failed to parse AI category+tags JSON:', err, 'raw:', text);
        return { category: null, tags: [] };
      }

      const rawCategory = parsed?.category;
      let category: ProjectCategory | null = null;
      if (typeof rawCategory === 'string') {
        const normalized = rawCategory.trim().toLowerCase();
        const match = allowedCategories.find(
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

      return { category, tags };
    } catch (err) {
      console.error('Error calling AI category+tags classifier:', err);
      return { category: null, tags: [] };
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
