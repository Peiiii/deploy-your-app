export const PLATFORM_AI_PROVIDER =
  process.env.PLATFORM_AI_PROVIDER || 'dashscope';

export const PLATFORM_AI_MODEL =
  process.env.PLATFORM_AI_MODEL || 'qwen3-max';

// 我们平台自己的 DashScope Key，用于平台 AI 能力（不是用户自己的 key）
export const DASHSCOPE_API_KEY =
  process.env.DASHSCOPE_API_KEY || process.env.DASHSCOPE_APIKEY || '';

