import React from 'react';

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
}) => (
  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
    <div className="flex items-center gap-3 mb-3">
      <div className={`p-2 rounded-lg bg-slate-50 dark:bg-slate-800 ${iconColor}`}>
        <Icon className="w-4 h-4" />
      </div>
      <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
        {label}
      </span>
    </div>
    <div className="space-y-1">
      <p className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
        {value}
      </p>
      <p className="text-xs text-slate-500 dark:text-gray-500 font-medium">
        {sublabel}
      </p>
    </div>
  </div>
);
