import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, Pin } from 'lucide-react';
import { getProjectDescription, getProjectThumbnailUrl } from '@/utils/project';
import { useProjectThumbnail } from '@/hooks/use-project-thumbnail';
import type { Project } from '@/types';

export function CreatorProjectCard({
  project,
  pinned = false,
  priority = false,
  actions,
}: {
  project: Project;
  pinned?: boolean;
  priority?: boolean;
  actions?: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const url = project.url
    ? (getProjectThumbnailUrl(project.url, { name: project.name, seed: project.id }) ?? undefined)
    : undefined;
  const thumbnail = useProjectThumbnail(url);
  const description = getProjectDescription(project, i18n.resolvedLanguage || i18n.language);
  return (
    <article className="group h-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white transition-shadow hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
      <a
        draggable={false}
        href={project.url || undefined}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${t('common.visit')}: ${project.name}`}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
      >
        <div className="relative aspect-video overflow-hidden border-b border-slate-100 bg-gradient-to-br from-brand-100 via-indigo-50 to-brand-50 dark:border-slate-800 dark:from-brand-950 dark:via-slate-800 dark:to-indigo-950">
          <div
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center text-7xl font-black text-brand-300/70 dark:text-brand-700/70"
          >
            {project.name.charAt(0).toUpperCase()}
          </div>
          {url && !thumbnail.error && (
            <img
              draggable={false}
              src={thumbnail.src}
              alt=""
              width={960}
              height={540}
              loading={priority ? 'eager' : 'lazy'}
              fetchPriority={priority ? 'high' : 'auto'}
              decoding="async"
              onLoad={thumbnail.onLoad}
              onError={thumbnail.onError}
              className={`absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03] ${thumbnail.loaded ? 'opacity-100' : 'opacity-0'}`}
            />
          )}
          {pinned && (
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-medium text-brand-700 shadow-sm dark:bg-slate-900/95 dark:text-brand-300">
              <Pin className="h-3 w-3" aria-hidden="true" />
              {t('profile.featured')}
            </span>
          )}
          {project.url && (
            <span
              aria-hidden="true"
              className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-sm dark:bg-slate-900/95 dark:text-white"
            >
              <ArrowUpRight className="h-4 w-4" />
            </span>
          )}
        </div>
        <div className="px-4 pt-4">
          <h3 className="truncate text-base font-semibold text-slate-900 group-hover:text-brand-600 dark:text-white dark:group-hover:text-brand-300">
            {project.name}
          </h3>
          <p className="mt-1.5 min-h-10 text-xs leading-5 text-slate-500 line-clamp-2 dark:text-slate-400">
            {description}
          </p>
        </div>
      </a>
      <div className="flex min-h-12 items-center justify-end gap-2 px-4 pb-3 pt-2">
        <div className="flex shrink-0 items-center gap-1">{actions}</div>
      </div>
    </article>
  );
}
