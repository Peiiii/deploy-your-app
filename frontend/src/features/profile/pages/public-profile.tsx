import React from 'react';
import { PageSkeleton } from '@/components/loading-state';
import { PageLayout } from '@/components/page-layout';
import { PageState } from '@/components/page-state';
import { getAuthorName, getAuthorColor, getAuthorInitial } from '@/utils/author';
import { resolvePublicAuthorIdentity } from '@gemigo/public-author';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePresenter } from '@/contexts/presenter-context';
import { usePublicProfileStore } from '@/features/profile/stores/public-profile.store';
import { useReactionStore } from '@/stores/reaction.store';
import {
  normalizeLinksForDisplay,
  resolveLinkKind,
  getEffectiveLabel,
} from '@/utils/profile-links';
import {
  Heart,
  Star,
  Zap,
  ExternalLink,
  ArrowLeft,
  Github,
  Twitter,
  Globe,
  Linkedin,
  Youtube,
} from 'lucide-react';

export const PublicProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const presenter = usePresenter();

  // Subscribe to store
  const data = usePublicProfileStore((s) => s.data);
  const requestedId = usePublicProfileStore((s) => s.requestedId);
  const isLoading = usePublicProfileStore((s) => s.isLoading);
  const error = usePublicProfileStore((s) => s.error);
  const reactionStore = useReactionStore();

  // Load profile on mount
  React.useEffect(() => {
    if (id) {
      presenter.publicProfile.loadProfile(id);
    }
  }, [id, presenter.publicProfile]);

  const reactionFor = (projectId: string) => reactionStore.byProjectId[projectId];

  if (isLoading || requestedId !== id) return <PageSkeleton title={t('profile.creatorProfile')} shape="profile" />;
  if (error || !data) return <PageLayout title={t('profile.creatorProfile')}><PageState
    title={error === 'network' ? t('experience.profileError') : t('profile.profileNotFound')}
    action={<div className="flex flex-wrap justify-center gap-3">{error === 'network' && <button className="btn-primary" onClick={() => { if (id) void presenter.publicProfile.loadProfile(id); }}>{t('common.retry')}</button>}<button className="btn-secondary" onClick={() => navigate('/explore')}><ArrowLeft className="h-4 w-4" />{t('explore.exploreApps')}</button></div>}
  /></PageLayout>;

  const publicAuthor = data.publicAuthor ?? resolvePublicAuthorIdentity({
    ownerId: data.user.id,
    handle: data.user.handle,
    displayName: data.user.displayName,
  });
  const authorName = getAuthorName(publicAuthor, t);
  const authorColor = getAuthorColor(publicAuthor.identityKey);

  const pinnedIds = data.profile.pinnedProjectIds ?? [];
  const pinnedSet = new Set(pinnedIds);
  const pinnedProjects = pinnedIds
    .map((id) => data.projects.find((p) => p.id === id))
    .filter((p): p is (typeof data.projects)[number] => !!p);
  const otherProjects = data.projects.filter((p) => !pinnedSet.has(p.id));

  const renderProjectCard = (
    project: (typeof data.projects)[number],
  ) => {
    const reactions = reactionFor(project.id);
    const likes =
      reactions?.likesCount ??
      (project as { likesCount?: number }).likesCount ??
      0;
    const favorites =
      reactions?.favoritesCount ??
      (project as { favoritesCount?: number }).favoritesCount ??
      0;
    const liked = reactions?.likedByCurrentUser ?? false;
    const favorited = reactions?.favoritedByCurrentUser ?? false;

    return (
      <div
        key={project.id}
        className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 flex flex-col gap-2"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
              {project.name}
            </div>
            {project.description && (
              <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                {project.description}
              </div>
            )}
          </div>
          {project.url && (
            <button
              type="button"
              onClick={() => {
                window.open(project.url, '_blank', 'noopener,noreferrer');
              }}
              className="inline-flex items-center gap-1 text-[11px] text-brand-600 dark:text-brand-400 hover:underline"
            >
              <span>{t('common.visit')}</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between text-xs pt-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={t('experience.favoriteApp', { name: project.name })} aria-pressed={favorited}
              onClick={() => presenter.publicProfile.toggleFavorite(project.id)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Star
                className={`w-3.5 h-3.5 ${favorited
                  ? 'text-amber-400 fill-amber-400'
                  : 'text-slate-400'
                  }`}
              />
              <span>{favorites.toLocaleString()}</span>
            </button>
            <button
              type="button"
              aria-label={t('experience.likeApp', { name: project.name })} aria-pressed={liked}
              onClick={() => presenter.publicProfile.toggleLike(project.id)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Heart
                className={`w-3 h-3 ${liked ? 'fill-pink-500 text-pink-500' : 'text-slate-400'
                  }`}
              />
              <span>{likes.toLocaleString()}</span>
            </button>
          </div>
          <div className="inline-flex items-center gap-1 text-slate-400">
            <Zap className="w-3 h-3" />
            <span className="text-[11px]">{project.framework}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6 md:space-y-8 ">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 shrink-0 rounded-full bg-gradient-to-tr ${authorColor} flex items-center justify-center text-lg font-semibold text-white`}>
            {getAuthorInitial(authorName, publicAuthor.anonymousCode)}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white tracking-tight break-words">
              {authorName}
            </h1>
            {data.user.handle && authorName !== `@${data.user.handle}` && (
              <p className="text-sm text-brand-600 dark:text-brand-400 break-all">@{data.user.handle}</p>
            )}
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('profile.creatorProfile')}
            </p>
          </div>
        </div>
      </div>

      {/* About + stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 glass-card rounded-xl p-5 border border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">
            {t('profile.about')}
          </h3>
          {data.profile.bio ? (
            <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">
              {data.profile.bio}
            </p>
          ) : null}
          {normalizeLinksForDisplay(data.profile.links).length > 0 ? (
            <div
              className={`space-y-2 text-xs text-slate-500 dark:text-slate-400 ${data.profile.bio ? 'mt-4' : ''
                }`}
            >
              {normalizeLinksForDisplay(data.profile.links).map((link, idx) => {
                const kind = resolveLinkKind(link.url);
                const label = getEffectiveLabel(link);
                const Icon =
                  kind === 'github'
                    ? Github
                    : kind === 'x'
                      ? Twitter
                      : kind === 'linkedin'
                        ? Linkedin
                        : kind === 'youtube'
                          ? Youtube
                          : Globe;

                let displayUrl = link.url;
                try {
                  const u = new URL(link.url);
                  const path = u.pathname && u.pathname !== '/' ? u.pathname : '';
                  displayUrl = `${u.hostname}${path}`;
                } catch {
                  displayUrl = link.url;
                }

                return (
                  <div key={idx} className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 text-slate-400" />
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      title={label}
                      className="text-brand-600 dark:text-brand-400 hover:underline truncate"
                    >
                      {displayUrl}
                    </a>
                  </div>
                );
              })}
            </div>
          ) : null}
          {!data.profile.bio &&
            normalizeLinksForDisplay(data.profile.links).length === 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400 italic">
                {t('profile.noBioOrLinks')}
              </p>
            )}
        </div>

        <div className="glass-card rounded-xl p-5 border border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">
            {t('profile.communityStats')}
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">
                {t('profile.publicApps')}
              </span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {data.stats.publicProjectsCount}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">
                {t('profile.totalLikes')}
              </span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {data.stats.totalLikes}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">
                {t('profile.totalFavorites')}
              </span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {data.stats.totalFavorites}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Pinned apps */}
      {pinnedProjects.length > 0 && (
        <div className="glass-card rounded-xl p-5 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {t('profile.pinnedApps')}
            </h3>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700">
              {pinnedProjects.length}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pinnedProjects.map((project) => renderProjectCard(project))}
          </div>
        </div>
      )}

      {/* All other apps */}
      <div className="glass-card rounded-xl p-5 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {t('profile.appsByCreator')}
          </h3>
        </div>
        {otherProjects.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-4">
            {t('profile.creatorNoPublicApps')}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {otherProjects.map((project) => renderProjectCard(project))}
          </div>
        )}
      </div>
    </div>
  );
};
