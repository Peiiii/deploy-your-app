import { useTranslation } from 'react-i18next';
import { PageLayout } from '@/components/page-layout';

export type SkeletonShape = 'projects' | 'details' | 'profile' | 'list' | 'apps';

export const ContentSkeleton = ({ shape = 'projects' }: { shape?: SkeletonShape }) => {
  const { t } = useTranslation();
  return (
    <div role="status" aria-label={t('common.loading')} className="w-full">
      <span className="sr-only">{t('common.loading')}</span>
      <div aria-hidden="true" className="space-y-6">
        {shape !== 'apps' && <div className="skeleton h-11 w-full max-w-md rounded-xl" />}
        {shape === 'projects' && (
          <div className="grid grid-cols-3 gap-3 sm:gap-5">
            {[0, 1, 2].map((key) => <div key={key} className="skeleton h-28 rounded-xl" />)}
          </div>
        )}
        {shape === 'profile' && <div className="skeleton h-44 rounded-2xl" />}
        <div className={shape === 'list' || shape === 'details' ? 'space-y-4' : 'grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3'}>
          {Array.from({ length: shape === 'details' ? 3 : 6 }, (_, index) => (
            <div key={index} className="surface-card overflow-hidden">
              {shape === 'apps' && <div className="skeleton aspect-video rounded-none" />}
              <div className={shape === 'apps' ? 'space-y-3 p-4' : 'space-y-4 p-5'}>
                <div className="skeleton h-4 w-2/3 rounded" />
                <div className="skeleton h-3 w-full rounded" />
                {shape !== 'apps' && <div className="skeleton h-3 w-4/5 rounded" />}
                <div className={`skeleton w-24 rounded-lg ${shape === 'apps' ? 'h-6' : 'mt-6 h-8'}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const PageSkeleton = ({ title, shape }: { title: string; shape?: SkeletonShape }) => (
  <PageLayout title={title}><ContentSkeleton shape={shape} /></PageLayout>
);
