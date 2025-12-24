import '@agent-labs/agent-chat/dist/index.css';
import type { AgentChatRef } from '@agent-labs/agent-chat';
import React, { useMemo, useRef } from 'react';

import {
  AgentChatWindow,
  MODEL,
  OPENAI_BASE_URL,
  SYSTEM_PROMPT,
  createOpenAIChatAgent,
  useAgentChatController,
  useGemigoTools,
  useParseTools,
} from './lib/agent';

const App: React.FC = () => {
  const chatRef = useRef<AgentChatRef | null>(null);

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

  const agent = useMemo(() => createOpenAIChatAgent({ apiKey, model, baseUrl }), [apiKey, model, baseUrl]);

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
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-4xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">AI Agent Demo</h1>
            <p className="text-xs text-slate-400">
              model=<span className="font-mono">{model}</span> baseUrl=<span className="font-mono">{baseUrl}</span>
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-900/60 shadow-xl">
          <AgentChatWindow
            ref={(instance) => {
              chatRef.current = instance;
            }}
            agentChatController={agentChatController}
            toolRenderers={toolRenderers}
            className="z-10"
          />
        </div>
      </div>
    </div>
  );
};

export default App;
