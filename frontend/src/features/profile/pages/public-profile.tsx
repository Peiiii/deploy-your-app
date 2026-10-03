import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check, Copy, LayoutGrid, Star, ThumbsUp } from 'lucide-react';
import { IconButton } from '@/components/icon-button';
import { usePresenter } from '@/contexts/presenter-context';
import { usePublicProfileStore } from '@/features/profile/stores/public-profile.store';
import { useReactionStore } from '@/stores/reaction.store';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { CreatorHeader } from '@/features/profile/components/creator-header';
import { CreatorProjectCard } from '@/features/profile/components/creator-project-card';
import { ProfileLoadingState } from '@/features/profile/components/my-profile/profile-loading-state';

export function PublicProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const presenter = usePresenter();
  const data = usePublicProfileStore((s) => s.data);
  const isLoading = usePublicProfileStore((s) => s.isLoading);
  const error = usePublicProfileStore((s) => s.error);
  const reactions = useReactionStore((s) => s.byProjectId);
  const { copied, copyToClipboard } = useCopyToClipboard({
    onSuccess: () => presenter.ui.showSuccessToast(t('profile.profileLinkCopied')),
  });
  useEffect(() => {
    if (id) void presenter.publicProfile.loadProfile(id);
  }, [id, presenter.publicProfile]);

  if (isLoading) return <ProfileLoadingState />;
  if (error || !data)
    return (
      <div className="mx-auto max-w-xl p-8 text-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t('profile.profileNotFound')}
        </h1>
        <button
          type="button"
          onClick={() => navigate('/explore')}
          className="mt-6 rounded-xl bg-brand-600 px-5 py-3 text-sm font-medium text-white"
        >
          {t('explore.exploreApps')}
        </button>
      </div>
    );

  const { pinnedProjects, otherProjects } = presenter.publicProfile.getProjectGroups();
  const renderCard = (project: (typeof data.projects)[number], index: number, pinned = false) => {
    const entry = reactions[project.id];
    return (
      <CreatorProjectCard
        key={project.id}
        project={project}
        pinned={pinned}
        priority={index < 3}
        actions={
          <>
            <IconButton
              label={t('previewActions.favorite')}
              size="sm"
              aria-pressed={entry?.favoritedByCurrentUser ?? false}
              onClick={() => presenter.publicProfile.toggleFavorite(project.id)}
              className="gap-1 text-slate-400"
            >
              <Star
                className={`h-4 w-4 ${entry?.favoritedByCurrentUser ? 'fill-amber-400 text-amber-500' : ''}`}
              />
              <span className="text-xs tabular-nums">
                {(entry?.favoritesCount ?? project.favoritesCount ?? 0).toLocaleString()}
              </span>
            </IconButton>
            <IconButton
              label={t('previewActions.like')}
              size="sm"
              aria-pressed={entry?.likedByCurrentUser ?? false}
              onClick={() => presenter.publicProfile.toggleLike(project.id)}
              className="gap-1 text-slate-400"
            >
              <ThumbsUp
                className={`h-4 w-4 ${entry?.likedByCurrentUser ? 'fill-brand-500 text-brand-500' : ''}`}
              />
              <span className="text-xs tabular-nums">
                {(entry?.likesCount ?? project.likesCount ?? 0).toLocaleString()}
              </span>
            </IconButton>
          </>
        }
      />
    );
  };
  return (
    <div className="creator-profile mx-auto w-full max-w-6xl space-y-8 p-4 sm:p-6 lg:p-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/explore')}
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-brand-600 dark:text-slate-400"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('explore.exploreApps')}
        </button>
      </div>
      <CreatorHeader
        data={data}
        actions={
          <IconButton
            label={t(copied ? 'common.copied' : 'profile.copyProfileLink')}
            size="auto"
            onClick={() =>
              void copyToClipboard(
                `${window.location.origin}/u/${encodeURIComponent(data.user.handle || data.user.id)}`
              )
            }
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            <span>{t('profile.copyProfileLink')}</span>
          </IconButton>
        }
      />
      <section className="space-y-5">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
          <LayoutGrid className="h-5 w-5 text-brand-500" aria-hidden="true" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('profile.works')}</h2>
          <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-600 dark:bg-brand-950 dark:text-brand-300">
            {data.projects.length}
          </span>
        </div>
        {pinnedProjects.length > 0 && (
          <div className="creator-grid">
            {pinnedProjects.map((project, index) => renderCard(project, index, true))}
          </div>
        )}
        {pinnedProjects.length > 0 && otherProjects.length > 0 && (
          <h3 className="pt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
            {t('profile.allApps')}
          </h3>
        )}
        {otherProjects.length > 0 && (
          <div className="creator-grid">
            {otherProjects.map((project, index) =>
              renderCard(project, pinnedProjects.length + index)
            )}
          </div>
        )}
        {data.projects.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-16 text-center dark:border-slate-700">
            <LayoutGrid className="mx-auto mb-4 h-8 w-8 text-brand-300" aria-hidden="true" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('profile.creatorNoPublicApps')}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
