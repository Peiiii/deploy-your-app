/**
 * Agent exports for the AI Agent demo app.
 *
 * Keep this file as a stable import surface for the demo app.
 * The actual agent implementation comes from @agent-labs/agent-toolkit.
 */

export { createOpenAIChatAgent } from '@agent-labs/agent-toolkit';
export {
  AgentChat,
  useParseTools,
  useAgentSessionManager as useAgentChatController,
} from '@agent-labs/agent-chat';

export { AGENT_TOOL_DEFS, createGemigoTools, useGemigoTools, getToolExecutors } from './tools';

export { OPENAI_BASE_URL, MODEL, SYSTEM_PROMPT } from './config';
