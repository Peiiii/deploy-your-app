import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Check, Copy, ExternalLink, Github, Globe, Lock, Settings } from 'lucide-react';
import { IconButton } from '@/components/icon-button';
import { getGitHubUrl, getProjectDescription, getProjectThumbnailUrl } from '@/utils/project';
import { useProjectThumbnail } from '@/hooks/use-project-thumbnail';
import { useAnalyticsStore } from '@/stores/analytics.store';
import type { Project } from '@/types';

const statusColors: Record<Project['status'], string> = {
  Live: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  Building: 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300',
  Failed: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  Offline: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

export function ProjectCard({
  project,
  onCopyUrl,
  isCopied,
  priority = false,
}: {
  project: Project;
  onCopyUrl: (url: string, id: string) => void;
  isCopied: (id: string) => boolean;
  priority?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language;
  const stats = useAnalyticsStore((s) => s.byProjectId[project.id]);
  const thumbnailUrl = project.url
    ? (getProjectThumbnailUrl(project.url, { name: project.name, seed: project.id }) ?? undefined)
    : undefined;
  const thumbnail = useProjectThumbnail(thumbnailUrl);
  const destination = `/projects/${encodeURIComponent(project.id)}`;
  const githubUrl = getGitHubUrl(project);
  const date = Date.parse(project.lastDeployed);
  const formattedDate = Number.isFinite(date)
    ? new Intl.DateTimeFormat(language, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date)
    : t('dashboard.notPublished');
  let domain = project.url;
  try {
    if (domain) domain = new URL(domain).hostname;
  } catch {
    /* Keep the supplied public address readable. */
  }
  const description = getProjectDescription(project, language);
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <Link
            to={destination}
            aria-label={`${t('common.manage')}: ${project.name}`}
            className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-brand-100 bg-brand-50 text-xl font-bold text-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-brand-900 dark:bg-brand-950"
          >
            {thumbnailUrl && !thumbnail.error ? (
              <div className="relative h-full w-full">
                <span
                  aria-hidden="true"
                  className="absolute inset-0 flex items-center justify-center"
                >
                  {project.name.charAt(0).toUpperCase()}
                </span>
                <img
                  src={thumbnail.src}
                  alt=""
                  draggable={false}
                  width={160}
                  height={112}
                  loading={priority ? 'eager' : 'lazy'}
                  decoding="async"
                  onLoad={thumbnail.onLoad}
                  onError={thumbnail.onError}
                  className={`absolute inset-0 h-full w-full object-cover ${thumbnail.loaded ? 'opacity-100' : 'opacity-0'}`}
                />
              </div>
            ) : (
              <span aria-hidden="true">{project.name.charAt(0).toUpperCase()}</span>
            )}
          </Link>
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${statusColors[project.status]}`}
          >
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full bg-current ${project.status === 'Building' ? 'motion-safe:animate-pulse' : ''}`}
            />
            {t(`dashboard.appStatus.${project.status}`)}
          </span>
        </div>
        <Link
          to={destination}
          className="mt-4 min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <h3 className="truncate text-base font-semibold text-slate-900 group-hover:text-brand-600 dark:text-white dark:group-hover:text-brand-300">
            {project.name}
          </h3>
        </Link>
        <p className="mt-1 truncate text-xs text-slate-400">
          {domain || t('dashboard.notPublished')}
        </p>
        <p className="mt-3 min-h-10 text-xs leading-5 text-slate-500 line-clamp-2 dark:text-slate-400">
          {description || t('dashboard.noDescription')}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1">
            {project.isPublic === false ? (
              <Lock className="h-3 w-3" aria-hidden="true" />
            ) : (
              <Globe className="h-3 w-3" aria-hidden="true" />
            )}
            {t(project.isPublic === false ? 'dashboard.unlistedApp' : 'dashboard.publicApp')}
          </span>
          {githubUrl && (
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-slate-500 hover:text-brand-600 dark:text-slate-400"
            >
              <Github className="h-3 w-3" aria-hidden="true" />
              GitHub
            </a>
          )}
        </div>
        <dl className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-t border-slate-100 pt-3 text-[11px] dark:border-slate-800">
          <div className="min-w-0">
            <dt className="text-slate-400">{t('dashboard.lastDeploy')}</dt>
            <dd className="mt-1 truncate font-medium text-slate-600 dark:text-slate-300">
              {formattedDate}
            </dd>
          </div>
          <div className="text-right">
            <dt className="text-slate-400">{t('appAnalytics.observed7d')}</dt>
            <dd className="mt-1 font-semibold tabular-nums text-slate-700 dark:text-slate-200">
              {stats?.stats?.range === '7d' && !stats.error && !stats.isLoading && stats.stats.pageViews != null ? stats.stats.pageViews.toLocaleString() : '—'}
            </dd>
          </div>
        </dl>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
        <Link
          to={destination}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-brand-300 dark:hover:bg-brand-950"
        >
          <Settings className="h-3.5 w-3.5" aria-hidden="true" />
          {t('common.manage')}
        </Link>
        <div className="flex items-center gap-1">
          {project.url && (
            <>
              <IconButton
                label={isCopied(project.id) ? t('common.copied') : t('common.copyUrl')}
                size="sm"
                onClick={() => onCopyUrl(project.url!, project.id)}
                className="text-slate-400"
              >
                {isCopied(project.id) ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </IconButton>
              <IconButton
                asChild
                label={`${t('common.visit')}: ${project.name}`}
                size="auto"
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-slate-600 dark:text-slate-300"
              >
                <a href={project.url} target="_blank" rel="noopener noreferrer">
                  <span>{t('common.visit')}</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </IconButton>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
