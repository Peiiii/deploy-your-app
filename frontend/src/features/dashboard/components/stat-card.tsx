import type { ElementType } from 'react';

export function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
  iconColor = 'text-brand-500',
}: {
  icon: ElementType;
  label: string;
  value: string;
  sublabel: string;
  iconColor?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex min-h-8 items-start gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 sm:min-h-0 sm:text-xs">
        <Icon
          className={`mt-0.5 hidden h-3.5 w-3.5 shrink-0 sm:block ${iconColor}`}
          aria-hidden="true"
        />
        <span>{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-white sm:text-3xl">
        {value}
      </p>
      <p className="mt-1 hidden text-[11px] text-slate-400 sm:block">{sublabel}</p>
    </div>
  );
}
