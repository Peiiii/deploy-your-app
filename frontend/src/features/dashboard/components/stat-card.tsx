import React from 'react';
import { useLayoutMode } from '@/hooks/use-layout-mode';

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  sublabel: string;
  iconColor?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  icon: Icon,
  label,
  value,
  sublabel,
  iconColor = 'text-brand-500',
}) => {
  const { isCompact } = useLayoutMode();

  return (
    <div className={`relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 ${isCompact ? 'p-4' : 'p-5'} shadow-sm hover:shadow-md transition-all duration-300 h-full overflow-hidden group`}>
      {/* Subtle Decorative Gradient */}
      <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-gradient-to-br from-brand-500/10 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl pointer-events-none" />

      <div className={`flex items-center gap-3 ${isCompact ? 'mb-2' : 'mb-3'} relative`}>
        <div className={`${isCompact ? 'p-2' : 'p-2.5'} rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-800/50 ${iconColor} transition-transform duration-300 group-hover:scale-110`}>
          <Icon className={`${isCompact ? 'w-4 h-4' : 'w-5 h-5'}`} />
        </div>
        <span className={`${isCompact ? 'text-xs' : 'text-sm'} font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate`}>
          {label}
        </span>
      </div>
      <div className="space-y-0.5 relative">
        <p className={`${isCompact ? 'text-2xl' : 'text-3xl'} font-bold text-slate-900 dark:text-white tracking-tight`}>
          {value}
        </p>
        <p className={`${isCompact ? 'text-[10px]' : 'text-xs'} text-slate-500 dark:text-gray-500 font-medium truncate`}>
          {sublabel}
        </p>
      </div>
    </div>
  );
};

