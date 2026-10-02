import { track } from '@/analytics/collector';
import { useTranslation } from 'react-i18next';
import { ChevronDown, FileCode, FileArchive, Github } from 'lucide-react';
import { SourceType } from '@/types';
import { Popover } from '@/components/popover';
import { AiPublishCard } from './ai-publish-card';

interface HomeDeploySectionProps {
  compact: boolean;
  onQuickDeploy: (sourceType: SourceType) => void;
}

export const HomeDeploySection = ({ compact, onQuickDeploy }: HomeDeploySectionProps) => {
  const { t } = useTranslation();
  const publish = (source: SourceType) => {
    track('quick_deploy_click', { dimension: source.toLowerCase() });
    onQuickDeploy(source);
  };
  return (
    <section
      aria-label={t('home.quickDeploy')}
      className="rounded-2xl border border-brand-100 dark:border-brand-900 bg-brand-50/60 dark:bg-brand-950/20 p-4 md:p-5"
    >
      <div
        className={`flex gap-3 ${compact ? 'flex-col' : 'flex-col xl:flex-row xl:items-center xl:justify-between'}`}
      >
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {t('home.publishHeading')}
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {t('home.publishDescription')}
          </p>
        </div>
        <div className="relative flex flex-wrap items-center gap-2">
          <button
            onClick={() => publish(SourceType.HTML)}
            className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <FileCode className="h-4 w-4" />
            {t('home.publishHtml')}
          </button>
          <button
            onClick={() => publish(SourceType.ZIP)}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50"
          >
            <FileArchive className="h-4 w-4" />
            {t('home.publishZip')}
          </button>
          <Popover
            className="sm:relative"
            triggerClassName="flex items-center gap-1 px-2 py-2.5 text-sm text-slate-600 dark:text-slate-300"
            trigger={
              <>
                {t('home.moreWays')}
                <ChevronDown className="h-4 w-4 group-aria-expanded:rotate-180" />
              </>
            }
            panelClassName="absolute left-0 sm:left-auto sm:right-0 top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] space-y-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-xl"
          >
            {(close) => (
              <>
                <button
                  onClick={() => {
                    close();
                    publish(SourceType.GITHUB);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Github className="h-4 w-4" />
                  {t('home.publishGithub')}
                </button>
                <AiPublishCard />
              </>
            )}
          </Popover>
        </div>
      </div>
    </section>
  );
};
