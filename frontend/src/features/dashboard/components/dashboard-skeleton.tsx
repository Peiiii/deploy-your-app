import { LoadingStatus, Skeleton } from '@/components/skeleton';

export function DashboardSkeleton({ list = false, count = 6 }: { list?: boolean; count?: number }) {
  return (
    <LoadingStatus>
      <div className={`management-grid ${list ? 'management-list' : ''}`}>
        {Array.from({ length: count }, (_, index) => (
          <div
            key={index}
            className="management-card overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700/50 dark:bg-slate-800"
          >
            <Skeleton className="management-cover rounded-none" />
            <div className="management-card-info px-4 pt-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="mt-1 h-5 w-full" />
            </div>
            <div className="management-card-meta flex justify-between px-4 py-2.5">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-8" />
            </div>
            <div className="management-card-actions flex gap-2 border-t border-slate-100 px-3 py-2.5 dark:border-slate-700/60">
              <Skeleton className="h-8 w-16 rounded-full !bg-brand-50 dark:!bg-brand-500/10" />
              <Skeleton className="h-8 w-16 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </LoadingStatus>
  );
}
