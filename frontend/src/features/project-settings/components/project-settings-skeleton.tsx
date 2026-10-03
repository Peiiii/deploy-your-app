import { LoadingStatus, Skeleton } from '@/components/skeleton';

export function ProjectSettingsSkeleton() {
  return (
    <LoadingStatus>
      <div className="border-b border-slate-200 bg-white px-4 pt-6 dark:border-slate-800 dark:bg-slate-900 md:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex items-center gap-4">
            <Skeleton className="h-14 w-14 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-7 w-48 max-w-full" />
              <Skeleton className="h-4 w-64 max-w-full" />
            </div>
          </div>
          <div className="flex gap-4 overflow-hidden pb-4">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-5 w-20 shrink-0" />
            ))}
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        {[0, 1].map((index) => (
          <div
            key={index}
            className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
          >
            <Skeleton className="h-5 w-32" />
            {[0, 1, 2].map((row) => (
              <div key={row} className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </LoadingStatus>
  );
}
