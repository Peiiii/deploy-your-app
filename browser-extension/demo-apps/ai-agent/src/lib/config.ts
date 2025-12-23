/**
 * Agent configuration constants.
 * Centralized config for easy modification and environment-specific overrides.
 */

/** OpenAI-compatible API endpoint */
// export const API_ENDPOINT = 'https://openai-api.gemigo.io/v1/chat/completions';
export const API_ENDPOINT = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

/** Model identifier used for chat completions */
export const MODEL = 'qwen3-max';

/** System prompt for the Agent Alchemist */
export const SYSTEM_PROMPT =
    'You are Agent Alchemist, a powerful browser agent. You can read, modify, and analyze any webpage using your Gemigo tools. Be concise, efficient, and visual.';
