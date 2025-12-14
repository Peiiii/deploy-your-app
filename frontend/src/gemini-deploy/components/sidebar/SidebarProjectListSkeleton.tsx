import React from 'react';

export const SidebarProjectListSkeleton: React.FC = () => {
  const widths = ['70%', '85%', '60%'];
  
  return (
    <div className="space-y-1">
      {Array.from({ length: 3 }).map((_, idx) => (
        <div
          key={idx}
          className="flex items-center gap-2 rounded-lg px-3 py-2 animate-pulse"
        >
          <div 
            className="h-4 bg-slate-200 dark:bg-slate-700 rounded" 
            style={{ width: widths[idx] || '70%' }}
          />
          <div className="w-3 h-3 bg-slate-200 dark:bg-slate-700 rounded flex-shrink-0" />
        </div>
      ))}
    </div>
  );
};

