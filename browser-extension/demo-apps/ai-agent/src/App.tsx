import '@agent-labs/agent-chat/dist/index.css';
import React, { useMemo } from 'react';

import {
  AgentChat,
  MODEL,
  OPENAI_BASE_URL,
  SYSTEM_PROMPT,
  createOpenAIChatAgent,
  useAgentChatController,
  useGemigoTools,
  useParseTools,
} from './lib/agent';

const App: React.FC = () => {
  const contexts = useMemo(
    () => [
      {
        description: '运行环境',
        value: JSON.stringify({
          platform: 'browser-extension',
          userAgent: navigator.userAgent,
        }),
      },
    ],
    []
  );

  const tools = useGemigoTools();
  const { toolDefs, toolExecutors, toolRenderers } = useParseTools(tools);

  const apiKey = import.meta.env.VITE_OPENAI_API_KEY?.toString() || 'no-key-required';
  const model = import.meta.env.VITE_OPENAI_MODEL?.toString() || MODEL;
  const baseUrl = (import.meta.env.VITE_OPENAI_BASE_URL?.toString() || OPENAI_BASE_URL).replace(/\/$/, '');

  console.log("[App] render", {
    apiKey,
    model,
    baseUrl,
  });
  const agent = useMemo(() => {
    const { run, ...rest } = createOpenAIChatAgent({ apiKey, model, baseUrl });
    const newRun = (...params: Parameters<typeof run>) => {
      const result = run(...params);
      console.log("[newRun] result", result);
      result.subscribe({
        next: (x) => {
          console.log(x);
        },
        error: (error) => {
          console.error(error);
        },
        complete: () => {
          console.log('complete');
        },
      });
      return result;
    };
    return {
      ...rest,
      run: newRun,
    };
  }, [apiKey, model, baseUrl]);

  const agentChatController = useAgentChatController({
    agent,
    getToolDefs: () => toolDefs,
    getContexts: () => contexts,
    initialMessages: [
      {
        id: 'system-1',
        role: 'system',
        parts: [{ type: 'text', text: SYSTEM_PROMPT }],
      },
    ],
    getToolExecutor: (name: string) => toolExecutors?.[name],
  });

  return (
    <div className="flex h-full w-full flex-col bg-white text-zinc-900 antialiased overflow-hidden">
      {/* Header */}
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
          <AgentChat
            agentChatController={agentChatController}
            toolRenderers={toolRenderers}
            className="h-full"
          />
        </div>
      </div>
    </div>
  );
};

export default App;
