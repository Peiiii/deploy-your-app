import { LoadingStatus, Skeleton } from '@/components/skeleton';

export function AppCardSkeletonGrid({
  compact = false,
  count = 6,
}: {
  compact?: boolean;
  count?: number;
}) {
  return (
    <LoadingStatus>
      <div className={`grid grid-cols-1 md:grid-cols-2 ${compact ? '' : 'lg:grid-cols-3'} gap-6`}>
        {Array.from({ length: count }, (_, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/40"
          >
            <Skeleton className="aspect-video rounded-none" />
            <div className="space-y-3 p-3">
              <Skeleton className="h-3 w-3/4" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-2 w-12" />
                </div>
                <Skeleton className="h-2 w-6" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </LoadingStatus>
  );
}
