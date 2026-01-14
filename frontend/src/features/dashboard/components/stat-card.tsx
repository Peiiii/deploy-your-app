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
    <div className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 ${isCompact ? 'p-4' : 'p-5'} shadow-sm transition-all duration-300 h-full`}>
      <div className={`flex items-center gap-3 ${isCompact ? 'mb-2' : 'mb-3'}`}>
        <div className={`p-2 rounded-lg bg-slate-50 dark:bg-slate-800 ${iconColor}`}>
          <Icon className={`${isCompact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
        </div>
        <span className={`${isCompact ? 'text-xs' : 'text-sm'} font-medium text-slate-500 dark:text-slate-400 truncate`}>
          {label}
        </span>
      </div>
      <div className="space-y-1">
        <p className={`${isCompact ? 'text-xl' : 'text-2xl'} font-bold text-slate-900 dark:text-white tracking-tight`}>
          {value}
        </p>
        <p className="text-[10px] md:text-xs text-slate-500 dark:text-gray-500 font-medium truncate">
          {sublabel}
        </p>
      </div>
    </div>
  );
};
