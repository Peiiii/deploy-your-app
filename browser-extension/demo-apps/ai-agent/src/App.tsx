import React, { useMemo } from 'react';
import { AgentChat, useAgentChat } from '@agent-labs/agent-chat';
import '@agent-labs/agent-chat/dist/index.css';

import { createOpenAIAgent, AGENT_TOOL_DEFS, getToolExecutors, API_ENDPOINT, MODEL } from './lib/agent';

const App: React.FC = () => {
  const agent = useMemo(
    () =>
      createOpenAIAgent({
        endpoint: API_ENDPOINT,
        model: MODEL,
        apiKey: import.meta.env.VITE_OPENAI_API_KEY,
        defaultTools: AGENT_TOOL_DEFS,
        debug: import.meta.env.DEV,
      }),
    []
  );

  const toolExecutors = useMemo(() => getToolExecutors(), []);

  const { sessionManager } = useAgentChat({
    agent,
    toolDefs: AGENT_TOOL_DEFS,
    toolExecutors,
    initialMessages: [
      {
        id: 'system-1',
        role: 'system',
        parts: [
          {
            type: 'text',
            text: 'You are Agent Alchemist, a powerful browser agent. You can read, modify, and analyze any webpage using your Gemigo tools. Be concise, efficient, and visual.',
          },
        ],
      },
    ],
  });

  return (
    <div className="flex h-full w-full flex-col bg-white text-zinc-900 antialiased overflow-hidden">
      {/* Search/Brand Header - Minimalist */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-200/60 bg-white shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-zinc-900 w-8 h-8 rounded flex items-center justify-center text-white">
            <span className="text-sm">🔮</span>
          </div>
          <h1 className="text-sm font-semibold tracking-tight text-zinc-900">
            Agent Alchemist
          </h1>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 relative bg-zinc-50/50">
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden agent-chat-container z-0">
          <AgentChat agentChatController={sessionManager} toolRenderers={{}} className="h-full" />
        </div>
      </div>
    </div>
  );
};

export default App;
