/**
 * Agent configuration constants.
 * Centralized config for easy modification and environment-specific overrides.
 */

/** OpenAI-compatible API base URL (must include `/v1`) */
export const OPENAI_BASE_URL = 'https://openai-api.gemigo.io/v1';

/** Model identifier used for chat completions */
export const MODEL = 'qwen3-max';

/** System prompt for the Agent Alchemist */
export const SYSTEM_PROMPT =
    'You are Agent Alchemist, a powerful browser agent. You can read, modify, and analyze any webpage using your Gemigo tools. Be concise, efficient, and visual.';
