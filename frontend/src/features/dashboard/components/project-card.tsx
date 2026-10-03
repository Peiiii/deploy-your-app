import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Check, Copy, ExternalLink, Play, Settings, TrendingUp, Github } from 'lucide-react';
import { IconButton } from '@/components/icon-button';
import { mapProjectsToApps, type ExploreAppCard } from '@/components/explore-app-card';
import { getProjectDescription, getGitHubUrl } from '@/utils/project';
import { useProjectThumbnail } from '@/hooks/use-project-thumbnail';
import { useAnalyticsStore } from '@/stores/analytics.store';
import { useUIStore } from '@/stores/ui.store';
import type { Project } from '@/types';

const statusColors: Record<Project['status'], string> = {
  Live: 'text-emerald-600 dark:text-emerald-400',
  Building: 'text-brand-600 dark:text-brand-300',
  Failed: 'text-red-600 dark:text-red-400',
  Offline: 'text-slate-500 dark:text-slate-400',
};

export function ProjectCard({
  project,
  onCopyUrl,
  isCopied,
  onPreview,
  priority = false,
}: {
  project: Project;
  onCopyUrl: (url: string, id: string) => void;
  isCopied: (id: string) => boolean;
  onPreview: (app: ExploreAppCard) => void;
  priority?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language;
  const app = useMemo(() => mapProjectsToApps([project])[0], [project]);
  const thumbnail = useProjectThumbnail(app.thumbnailUrl);
  const stats = useAnalyticsStore((s) => s.byProjectId[project.id]);
  const views =
    stats?.stats && !stats.error && !stats.isLoading && stats.stats.range === '7d'
      ? stats.stats.pageViews
      : null;
  const selected = useUIStore((s) => s.rightPanelAppId === project.id);
  const githubUrl = getGitHubUrl(project);
  const destination = `/projects/${encodeURIComponent(project.id)}`;
  const date = Date.parse(project.lastDeployed);
  const formattedDate = Number.isFinite(date)
    ? new Intl.DateTimeFormat(language, { year: 'numeric', month: 'short', day: 'numeric' }).format(
        date
      )
    : t('dashboard.notPublished');
  const description = getProjectDescription(project, language);
  let domain = project.url;
  try {
    if (domain) domain = new URL(domain).hostname;
  } catch {
    /* Display the supplied public address. */
  }
  const cover = (
    <>
      <span
        aria-hidden="true"
        className={`management-cover-fallback absolute inset-0 bg-gradient-to-br ${app.color}`}
      >
        <span className="absolute inset-0 bg-black/5" />
        <span className="management-cover-initial absolute inset-0 flex items-center justify-center font-black text-white opacity-40">
          {project.name.charAt(0).toUpperCase()}
        </span>
      </span>
      {app.thumbnailUrl && !thumbnail.error && (
        <img
          src={thumbnail.src}
          alt=""
          width={960}
          height={540}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={thumbnail.onLoad}
          onError={thumbnail.onError}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity ${thumbnail.loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
      {project.url && (
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center bg-black/15 opacity-0 transition-opacity group-hover/cover:opacity-100 group-focus-visible/cover:opacity-100"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white/25 text-white backdrop-blur-sm">
            <Play className="h-5 w-5 fill-current" />
          </span>
        </span>
      )}
    </>
  );
  return (
    <article
      className={`management-card group rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-lg dark:bg-slate-800 ${selected ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-slate-200/60 dark:border-slate-700/50'}`}
    >
      <div className="management-cover relative overflow-hidden rounded-t-2xl">
        {project.url ? (
          <button
            type="button"
            onClick={() => onPreview(app)}
            aria-label={`${t('dashboard.previewApp')}: ${project.name}`}
            className="group/cover absolute inset-0 h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
          >
            {cover}
          </button>
        ) : (
          <Link
            to={destination}
            aria-label={`${t('common.manage')}: ${project.name}`}
            className="group/cover absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
          >
            {cover}
          </Link>
        )}
        <span
          className={`management-cover-status pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-medium shadow-sm backdrop-blur-sm dark:bg-slate-900/95 ${statusColors[project.status]}`}
        >
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-full bg-current ${project.status === 'Building' ? 'motion-safe:animate-pulse' : ''}`}
          />
          {t(`dashboard.appStatus.${project.status}`)}
        </span>
      </div>
      <div className="management-card-info min-w-0 px-4 pt-3">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            to={destination}
            className="min-w-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <h2 className="truncate text-sm font-semibold text-slate-900 transition-colors hover:text-brand-600 dark:text-white dark:hover:text-brand-300">
              {project.name}
            </h2>
          </Link>
          <span
            className={`management-list-status shrink-0 items-center gap-1 text-[11px] ${statusColors[project.status]}`}
          >
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
            {t(`dashboard.appStatus.${project.status}`)}
          </span>
        </div>
        <p className="management-description mt-1 truncate text-xs leading-5 text-slate-500 dark:text-slate-400">
          {description || domain || t('dashboard.noDescription')}
        </p>
        <p className="management-domain mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
          {domain || t('dashboard.notPublished')}
        </p>
      </div>
      <div className="management-card-meta flex min-w-0 items-center justify-between gap-3 px-4 py-2.5 text-[11px] text-slate-500 dark:text-slate-400">
        <span className="truncate" title={`${t('dashboard.lastDeploy')}: ${formattedDate}`}>
          {t(project.isPublic === false ? 'dashboard.unlistedApp' : 'dashboard.publicApp')}
          <span aria-hidden="true" className="mx-1.5">
            ·
          </span>
          {formattedDate}
        </span>
        <span
          aria-label={`${t('appAnalytics.observed7d')}: ${views ?? t('dashboard.statsUnavailable')}`}
          title={t('appAnalytics.observed7d')}
          className="inline-flex shrink-0 items-center gap-1 tabular-nums"
        >
          <TrendingUp className="h-3 w-3" aria-hidden="true" />
          {views != null ? views.toLocaleString() : '—'}
        </span>
      </div>
      <div className="management-card-actions flex items-center gap-2 border-t border-slate-100 px-3 py-2.5 dark:border-slate-700/60">
        <Link
          to={destination}
          className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-full bg-brand-50 px-3 text-xs font-semibold text-brand-600 hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:bg-brand-500/10 dark:text-brand-300 dark:hover:bg-brand-500/20"
        >
          <Settings className="h-3.5 w-3.5" aria-hidden="true" />
          {t('common.manage')}
        </Link>
        {project.url && (
          <>
            <IconButton
              asChild
              label={`${t('common.visit')}: ${project.name}`}
              size="auto"
              className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-full px-2.5 text-xs text-slate-500 dark:text-slate-300"
            >
              <a href={project.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                <span>{t('common.visit')}</span>
              </a>
            </IconButton>
            <IconButton
              label={isCopied(project.id) ? t('common.copied') : t('common.copyUrl')}
              size="sm"
              onClick={() => onCopyUrl(project.url!, project.id)}
              className="ml-auto rounded-full text-slate-400"
            >
              {isCopied(project.id) ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </IconButton>
          </>
        )}
        {githubUrl && (
          <IconButton
            asChild
            label={`${t('deployment.githubRepository')}: ${project.name}`}
            size="sm"
            className="rounded-full text-slate-400"
          >
            <a href={githubUrl} target="_blank" rel="noopener noreferrer">
              <Github className="h-4 w-4" />
            </a>
          </IconButton>
        )}
      </div>
    </article>
  );
}
