import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Terminal, Activity, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { runAgentLoop, type AgentMessage } from './lib/agent';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const App: React.FC = () => {
  const [messages, setMessages] = useState<AgentMessage[]>([
    { role: 'system', content: 'You are Agent Alchemist, a powerful browser agent. You can read, modify, and analyze any webpage using your GemiGo tools. Be concise, efficient, and visual.' }
  ]);
  const [input, setInput] = useState('');
  const [isIdle, setIsIdle] = useState(true);
  const [status, setStatus] = useState<'idle' | 'thinking' | 'acting'>('idle');
  const [currentAction, setCurrentAction] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !isIdle) return;

    const userMsg: AgentMessage = { role: 'user', content: input };
    const newMessages = [...messages, userMsg];

    setMessages(newMessages);
    setInput('');
    setIsIdle(false);
    setStatus('thinking');

    await runAgentLoop(
      newMessages,
      (updated) => setMessages(updated),
      (toolName) => {
        setStatus('acting');
        setCurrentAction(toolName);
      }
    );

    setIsIdle(true);
    setStatus('idle');
    setCurrentAction(null);
  };

  return (
    <div className="flex flex-col h-screen w-full p-4 gap-4 bg-slate-950 font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 glass-card rounded-2xl halo-blue">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-cyan-500 to-purple-600 p-2 rounded-xl shadow-lg shadow-cyan-500/20">
            <Zap className="w-6 h-6 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight cyber-gradient-text">
              AGENT ALCHEMIST
            </h1>
            <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">
              GemiGo Browser Copilot
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-2">
              <span className={cn(
                "w-2 h-2 rounded-full animate-pulse",
                status === 'idle' ? "bg-emerald-500" : status === 'thinking' ? "bg-amber-500" : "bg-cyan-500"
              )} />
              <span className="text-xs font-mono text-slate-400 capitalize">{status}</span>
            </div>
            {currentAction && (
              <motion.span
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[10px] text-cyan-400 font-mono"
              >
                CALLING: {currentAction}()
              </motion.span>
            )}
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto glass-card rounded-3xl p-6 flex flex-col gap-6 relative group">
        {/* Decorative mesh background */}
        <div className="absolute inset-0 bg-mesh opacity-20 pointer-events-none group-hover:opacity-30 transition-opacity duration-700" />

        <AnimatePresence initial={false}>
          {messages.filter(m => m.role !== 'system' && m.role !== 'tool').map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={cn(
                "flex flex-col max-w-[85%] gap-2",
                msg.role === 'user' ? "ml-auto items-end" : "items-start"
              )}
            >
              <div className={cn(
                "flex items-center gap-2 mb-1",
                msg.role === 'user' ? "flex-row-reverse" : "flex-row"
              )}>
                {msg.role === 'user' ? <User className="w-3 h-3 text-slate-400" /> : <Bot className="w-3 h-3 text-cyan-400" />}
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-tighter">
                  {msg.role === 'user' ? 'Human' : 'Alchemist'}
                </span>
              </div>
              <div className={cn(
                "px-5 py-3 rounded-2xl text-sm leading-relaxed shadow-lg border",
                msg.role === 'user'
                  ? "bg-slate-800/80 border-slate-700 text-slate-200 rounded-tr-none"
                  : "bg-cyan-900/10 border-cyan-500/20 text-cyan-50 rounded-tl-none shadow-cyan-950/20 backdrop-blur-md"
              )}>
                {msg.content || (msg.tool_calls && <div className="flex items-center gap-2 text-cyan-400 italic"><Activity className="w-4 h-4 animate-spin" /> Thinking...</div>)}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={chatEndRef} />
      </main>

      {/* Input Bar */}
      <footer className="relative flex items-center gap-3 p-2 glass-card rounded-2xl border-white/5 focus-within:border-cyan-500/50 transition-colors duration-300">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-2xl opacity-0 group-focus-within:opacity-20 blur transition-all duration-500 pointer-events-none" />

        <div className="pl-4 text-slate-500">
          <Terminal className="w-5 h-5" />
        </div>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          disabled={!isIdle}
          placeholder={isIdle ? "Command the Agent..." : "Agent is working..."}
          className="flex-1 bg-transparent border-none outline-none text-slate-100 placeholder:text-slate-600 font-sans p-3 disabled:opacity-50"
        />

        <button
          onClick={handleSend}
          disabled={!isIdle || !input.trim()}
          className={cn(
            "p-3 rounded-xl transition-all duration-300 shadow-xl",
            !isIdle || !input.trim()
              ? "bg-slate-800 text-slate-600"
              : "bg-gradient-to-br from-cyan-500 to-blue-600 text-white hover:scale-105 active:scale-95 shadow-cyan-500/20"
          )}
        >
          <Send className="w-5 h-5" />
        </button>
      </footer>
    </div>
  );
};

export default App;
