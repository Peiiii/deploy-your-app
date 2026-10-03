import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { resolvePublicAuthorIdentity } from '@gemigo/public-author';
import { Github, Globe, Linkedin, Twitter, Youtube } from 'lucide-react';
import { getAuthorColor, getAuthorInitial, getAuthorName } from '@/utils/author';
import {
  getEffectiveLabel,
  normalizeLinksForDisplay,
  resolveLinkKind,
} from '@/utils/profile-links';
import type { PublicUserProfile } from '@/types';
import '@/features/profile/components/creator-profile.css';

interface CreatorHeaderProps {
  data: Pick<PublicUserProfile, 'user' | 'publicAuthor' | 'profile' | 'stats'>;
  actions?: ReactNode;
}

export function CreatorHeader({ data, actions }: CreatorHeaderProps) {
  const { t } = useTranslation();
  const author =
    data.publicAuthor ??
    resolvePublicAuthorIdentity({
      ownerId: data.user.id,
      handle: data.user.handle,
      displayName: data.user.displayName,
    });
  const name = getAuthorName(author, t);
  const stats = [
    [data.stats.publicProjectsCount, t('profile.publicApps')],
    [data.stats.totalLikes, t('profile.totalLikes')],
    [data.stats.totalFavorites, t('profile.totalFavorites')],
  ] as const;
  return (
    <section className="creator-header overflow-hidden rounded-3xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="creator-cover relative h-28 sm:h-36 overflow-hidden" aria-hidden="true">
        <div className="creator-cover-orbit" />
        <div className="absolute right-6 top-5 text-xs font-semibold tracking-[0.2em] text-brand-600/60 dark:text-brand-300/60">
          GEMIGO / CREATOR
        </div>
      </div>
      <div className="relative px-5 pb-6 sm:px-8 sm:pb-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div
            aria-hidden="true"
            className={`-mt-10 flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-tr ${getAuthorColor(author.identityKey)} text-3xl font-bold text-white shadow-lg ring-[6px] ring-white dark:ring-slate-900 sm:h-28 sm:w-28 sm:text-4xl`}
          >
            {getAuthorInitial(name, author.anonymousCode)}
          </div>
          {actions && <div className="flex flex-wrap gap-2 pt-4">{actions}</div>}
        </div>
        <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-xs font-semibold tracking-wider text-brand-600 dark:text-brand-400">
              {t('profile.creatorProfile')}
            </p>
            <h1 className="break-words text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              {name}
            </h1>
            {data.user.handle && name !== `@${data.user.handle}` && (
              <p className="mt-1 break-all text-sm text-slate-500 dark:text-slate-400">
                @{data.user.handle}
              </p>
            )}
            {data.profile.bio && (
              <p className="mt-4 max-w-2xl whitespace-pre-line break-words text-sm leading-7 text-slate-600 dark:text-slate-300">
                {data.profile.bio}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {normalizeLinksForDisplay(data.profile.links)
                .filter((link) => /^https?:\/\//i.test(link.url.trim()))
                .map((link, index) => {
                  const kind = resolveLinkKind(link.url);
                  const Icon = {
                    github: Github,
                    x: Twitter,
                    linkedin: Linkedin,
                    youtube: Youtube,
                    website: Globe,
                    bilibili: Globe,
                    other: Globe,
                  }[kind];
                  const label =
                    link.label?.trim() ||
                    (kind === 'website' ? new URL(link.url).hostname : getEffectiveLabel(link));
                  return (
                    <a
                      key={index}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="creator-social inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition-colors hover:border-brand-300 hover:text-brand-600 dark:border-slate-700 dark:text-slate-300 dark:hover:text-brand-300"
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{label}</span>
                    </a>
                  );
                })}
            </div>
          </div>
          <dl className="grid shrink-0 grid-cols-3 gap-4 border-t border-slate-100 pt-5 dark:border-slate-800 sm:gap-8 lg:border-t-0 lg:pt-0">
            {stats.map(([value, label]) => (
              <div key={label}>
                <dd className="text-2xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-white">
                  {value.toLocaleString()}
                </dd>
                <dt className="mt-1 text-xs text-slate-500 dark:text-slate-400">{label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
