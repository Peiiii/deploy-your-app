/** Cumulative count, visually overlaid without changing an action's hit area. */
export function ActionCount({ count }: { count?: number }) {
  if (count === undefined || !Number.isSafeInteger(count) || count <= 0) return null;
  return (
    <span
      aria-hidden="true"
      data-action-count
      className="pointer-events-none absolute right-0 -top-0.5 z-10 min-w-2 rounded-sm bg-white/95 px-0.5 text-center text-[9px] font-medium leading-[11px] tabular-nums text-slate-600 dark:bg-slate-900/95 dark:text-slate-300"
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
