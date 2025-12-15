import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePresenter } from '@/contexts/PresenterContext';
import { usePublicProfileStore } from '@/stores/publicProfileStore';
import { useReactionStore } from '@/stores/reactionStore';
import {
  normalizeLinksForDisplay,
  resolveLinkKind,
  getEffectiveLabel,
} from '@/utils/profileLinks';
import {
  Heart,
  Star,
  Zap,
  ExternalLink,
  Lock,
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

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 max-w-5xl mx-auto flex items-center justify-center h-full animate-fade-in">
        <div className="glass-card rounded-2xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center animate-pulse">
            <Lock className="w-6 h-6 text-slate-500 dark:text-slate-300" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {t('common.loading')}
          </h2>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto flex items-center justify-center h-full animate-fade-in">
        <div className="glass-card rounded-2xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur max-w-md w-full text-center space-y-4">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {t('profile.creatorProfile')}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('profile.profileNotFound')}
          </p>
          <button
            type="button"
            onClick={() => navigate('/explore')}
            className="mt-2 inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 transition-all"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            {t('explore.exploreApps')}
          </button>
        </div>
      </div>
    );
  }

  const pinnedIds = data.profile.pinnedProjectIds ?? [];
  const pinnedSet = new Set(pinnedIds);
  const pinnedProjects = pinnedIds
    .map((id) => data.projects.find((p) => p.id === id))
    .filter((p): p is (typeof data.projects)[number] => !!p);
  const otherProjects = data.projects.filter((p) => !pinnedSet.has(p.id));

  const renderProjectCard = (
    project: (typeof data.projects)[number],
    isPinned: boolean = false,
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
              onClick={() => presenter.publicProfile.toggleFavorite(project.id)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Star
                className={`w-3.5 h-3.5 ${
                  favorited
                    ? 'text-amber-400 fill-amber-400'
                    : 'text-slate-400'
                }`}
              />
              <span>{favorites.toLocaleString()}</span>
            </button>
            <button
              type="button"
              onClick={() => presenter.publicProfile.toggleLike(project.id)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Heart
                className={`w-3 h-3 ${
                  liked ? 'fill-pink-500 text-pink-500' : 'text-slate-400'
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
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6 md:space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-brand-500 to-purple-600 flex items-center justify-center text-lg font-semibold text-white">
            {(data.user.displayName || data.user.email || 'U')
              .toUpperCase()
              .charAt(0)}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {data.user.displayName ||
                data.user.email ||
                t('profile.creatorProfile')}
            </h2>
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
              className={`space-y-2 text-xs text-slate-500 dark:text-slate-400 ${
                data.profile.bio ? 'mt-4' : ''
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
            {pinnedProjects.map((project) => renderProjectCard(project, true))}
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
