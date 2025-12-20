import React, { useEffect, useRef } from 'react';
import type { BuildLog } from '@/types';

interface TerminalProps {
  logs: BuildLog[];
  className?: string;
}

const SCROLL_THRESHOLD = 100; // pixels from bottom to consider "at bottom"

export const Terminal: React.FC<TerminalProps> = ({ logs, className }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  // Check if user is near bottom of scroll
  const checkIfNearBottom = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const nearBottom = distanceFromBottom <= SCROLL_THRESHOLD;

    shouldAutoScrollRef.current = nearBottom;
  };

  // Auto scroll to bottom if user is near bottom
  useEffect(() => {
    if (shouldAutoScrollRef.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Handle scroll events
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      checkIfNearBottom();
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Initial check when component mounts or logs change
  useEffect(() => {
    checkIfNearBottom();
  }, [logs]);

  return (
    <div className={`bg-[#0d1117] flex flex-col font-mono text-sm ${className}`}>
      <div
        ref={scrollContainerRef}
        className="p-6 overflow-y-auto h-[420px] terminal-scroll space-y-2"
      >
        {logs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 opacity-50">
            <span className="text-4xl mb-2">⌨️</span>
            <span>Initializing build sequence...</span>
          </div>
        )}
        {logs.map((log, index) => (
          <div key={index} className="flex gap-4 group hover:bg-white/5 -mx-2 px-2 py-0.5 rounded transition-colors">
            <span className="text-gray-600 select-none min-w-[80px] text-xs pt-0.5">{log.timestamp}</span>
            <span className={`break-all leading-relaxed ${log.type === 'error' ? 'text-red-400 font-bold' :
                log.type === 'success' ? 'text-green-400' :
                  log.type === 'warning' ? 'text-yellow-400' : 'text-gray-300'
              }`}>
              {log.type === 'success' ? <span className="text-green-500 mr-2">✓</span> :
                log.type === 'error' ? <span className="text-red-500 mr-2">✗</span> :
                  <span className="text-gray-600 mr-2">$</span>}
              {log.message}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
