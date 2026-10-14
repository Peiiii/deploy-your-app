/** The opaque halo cuts into the icon corner without changing the action hit area. */
export function ActionCount({ count }: { count?: number }) {
  if (count === undefined || !Number.isSafeInteger(count) || count <= 0) return null;
  return (
    <span
      aria-hidden="true"
      data-action-count
      className="pointer-events-none absolute right-[3px] top-0 z-10 min-w-2 rounded-sm bg-white px-px text-center text-[9px] font-medium leading-[10px] tabular-nums text-slate-600 ring-2 ring-white dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-900"
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
