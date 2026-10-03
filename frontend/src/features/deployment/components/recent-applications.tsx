import { IconButton } from '@/components/icon-button';
import { LoadingStatus, Skeleton } from '@/components/skeleton';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, ChevronDown, RefreshCw, AppWindow } from 'lucide-react';
import { usePresenter } from '@/contexts/presenter-context';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { useProjectStore } from '@/stores/project.store';
import { getProjectThumbnailUrl } from '@/utils/thumbnail-url';

export function RecentApplications({ disabled }: { disabled: boolean }) {
  const { t, i18n } = useTranslation();
  const presenter = usePresenter();
  const navigate = useNavigate();
  const ownerId = useAuthStore(s => s.user?.id ?? null);
  const { recentOwnerId, recentProjects, recentLoading, recentError } = useProjectStore();
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    void presenter.project.loadRecentProjects(ownerId);
  }, [ownerId, presenter.project]);
  if (!ownerId || recentOwnerId !== ownerId || (!recentLoading && !recentError && recentProjects.length === 0)) return null;

  return (
    <aside className="order-first min-w-0 self-start rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:order-last lg:sticky lg:top-6" aria-labelledby="recent-applications-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="recent-applications-heading" className="text-sm font-semibold text-slate-900 dark:text-white">{t('deployment.recentAppsHeading')}</h2>
        <IconButton size="auto" label={t('deployment.recentAppsToggle')} className="rounded-md p-1 text-slate-500 lg:hidden" aria-expanded={expanded} aria-controls="recent-applications-list" onClick={() => setExpanded(!expanded)}>
          <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </IconButton>
      </div>
      <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">{t('deployment.recentAppsDescription')}</p>
      <div id="recent-applications-list" className={`${expanded ? 'block' : 'hidden'} mt-3 lg:block`}>
        {recentLoading && recentProjects.length === 0 && <LoadingStatus className="py-2">
          <div className="space-y-3">{[0, 1, 2].map(index => <div key={index} className="flex items-center gap-3">
            <Skeleton className="h-11 w-14 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2"><Skeleton className="h-3 w-3/4" /><Skeleton className="h-2 w-1/2" /></div>
          </div>)}</div>
        </LoadingStatus>}
        {recentError && <div role="status" className="space-y-2 py-2 text-xs text-slate-500">
          <p>{t('deployment.recentAppsError')}</p>
          <button type="button" className="inline-flex items-center gap-1 rounded-md text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" onClick={() => void presenter.project.loadRecentProjects(ownerId)}><RefreshCw className="h-3 w-3" />{t('common.retry')}</button>
        </div>}
        <ul className="space-y-1">
          {recentProjects.map(project => {
            const thumbnail = getProjectThumbnailUrl(project.url, { name: project.name, seed: project.id });
            const date = project.lastSuccessAt || project.createdAt || project.lastDeployed;
            const timestamp = date ? new Date(date) : null;
            return <li key={project.id}>
              <button type="button" disabled={disabled} onClick={() => {
                if (presenter.deployment.prepareExistingUpdate(project)) navigate(`/projects/${encodeURIComponent(project.id)}?tab=deployments`);
              }} className="group flex w-full min-w-0 items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-50 dark:hover:bg-slate-800" aria-label={t('deployment.updateNamedApp', { name: project.name })}>
                <span className="relative flex h-11 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-400 dark:bg-slate-800">
                  <AppWindow className="h-5 w-5" />
                  {thumbnail && <img src={thumbnail} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" onError={event => { event.currentTarget.style.display = 'none'; }} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">{project.name}</span>
                  <span className="block truncate text-xs text-slate-500">{project.url?.replace(/^https?:\/\//, '').replace(/\/$/, '') || t('deployment.notPublishedYet')}</span>
                  <span className="block text-[11px] text-slate-400">{timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp.toLocaleDateString(i18n.language) : ''}</span>
                </span>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-brand-600" />
              </button>
            </li>;
          })}
        </ul>
        <Link to="/dashboard" className="mt-3 inline-flex rounded-md text-xs font-medium text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-brand-300">{t('deployment.viewAllApps')}</Link>
      </div>
    </aside>
  );
}
