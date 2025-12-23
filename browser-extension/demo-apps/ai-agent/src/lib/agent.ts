/**
 * Agent exports for the AI Agent demo app.
 * 
 * Re-exports core functionality from the modular lib files.
 */

// Re-export the factory function
export { createOpenAIAgent, type OpenAIAgentOptions } from './openai-agent';

// Re-export serialization utilities
export { serializeToOpenAI, parseOpenAIStream, mapToolsToOpenAI } from './openai-adapter';

// Re-export tool definitions and executors
export { AGENT_TOOL_DEFS } from './tools/definitions';
export { getToolExecutors } from './tools/executors';

// Re-export config
export { API_ENDPOINT, MODEL, SYSTEM_PROMPT } from './config';
