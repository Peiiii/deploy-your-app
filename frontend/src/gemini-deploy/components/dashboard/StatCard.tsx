import React from 'react';

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  sublabel: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  icon: Icon,
  label,
  value,
  sublabel,
  color,
  bgColor,
  borderColor,
}) => (
  <div
    className={`glass-card p-5 rounded-xl border ${borderColor} hover:shadow-lg transition-all duration-300`}
  >
    <div className="flex items-center gap-4">
      <div
        className={`w-12 h-12 rounded-lg flex items-center justify-center ${bgColor} ${color} flex-shrink-0`}
      >
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-slate-500 dark:text-gray-400 text-sm font-medium truncate">
          {label}
        </p>
        <p className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          {value}
        </p>
        <p className={`text-xs ${color} mt-0.5`}>{sublabel}</p>
      </div>
    </div>
  </div>
);
