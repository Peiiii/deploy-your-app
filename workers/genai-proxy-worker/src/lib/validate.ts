import type { GoogleGenerateContentRequest } from './google/types';

export function validateTextOnlyRequest(req: GoogleGenerateContentRequest): string | null {
  for (const content of req.contents || []) {
    for (const part of content.parts || []) {
      const hasText = typeof part.text === 'string';
      const hasFunctionResponse = part.functionResponse !== undefined;

      if (!hasText && !hasFunctionResponse) {
        return 'Phase 1 only supports text prompts (and tool/function responses).';
      }
    }
  }
  return null;
}

