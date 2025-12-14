import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';
import { useMyProfileStore } from '../stores/myProfileStore';
import { usePresenter } from '../contexts/PresenterContext';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import {
  Copy,
  Check,
  Lock,
  Pin,
  PinOff,
  Share2,
  Plus,
  X,
  ArrowUp,
  ArrowDown,
  GripVertical,
} from 'lucide-react';

export const MyProfile: React.FC = () => {
  const { t } = useTranslation();
  const presenter = usePresenter();
  const user = useAuthStore((s) => s.user);
  const isLoadingAuth = useAuthStore((s) => s.isLoading);

  // Subscribe to store state individually
  const profileData = useMyProfileStore((s) => s.profileData);
  const bio = useMyProfileStore((s) => s.bio);
  const links = useMyProfileStore((s) => s.links);
  const handleInput = useMyProfileStore((s) => s.handleInput);
  const pinnedIds = useMyProfileStore((s) => s.pinnedIds);
  const handleError = useMyProfileStore((s) => s.handleError);
  const draggingPinnedId = useMyProfileStore((s) => s.draggingPinnedId);
  const isLoading = useMyProfileStore((s) => s.isLoading);
  const isSaving = useMyProfileStore((s) => s.isSaving);
  const actions = useMyProfileStore((s) => s.actions);

  const { copied, copyToClipboard } = useCopyToClipboard({
    onSuccess: () => {
      presenter.ui.showSuccessToast(t('profile.profileLinkCopied'));
    },
  });

  // Get public projects
  const myProjects = presenter.myProfile.getMyProjects();

  // Load profile on mount
  React.useEffect(() => {
    if (user) {
      presenter.myProfile.loadProfile();
    }
  }, [user, presenter.myProfile]);

  // Handle drag events
  const handlePinnedDragStart = (e: React.DragEvent, projectId: string) => {
    e.stopPropagation();
    presenter.myProfile.handlePinnedDragStart(projectId);
  };

  const handlePinnedDragOver = (
    e: React.DragEvent<HTMLDivElement>,
    projectId: string,
  ) => {
    if (!draggingPinnedId || draggingPinnedId === projectId) return;
    if (!pinnedIds.includes(projectId)) return;
    e.preventDefault();
    e.stopPropagation();
  };

  const handlePinnedDrop = (
    e: React.DragEvent<HTMLDivElement>,
    projectId: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    presenter.myProfile.handlePinnedDrop(projectId);
  };

  if (isLoadingAuth) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto flex items-center justify-center h-full animate-fade-in">
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

  if (!user) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto flex items-center justify-center h-full animate-fade-in">
        <div className="glass-card rounded-2xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <Lock className="w-6 h-6 text-slate-500 dark:text-slate-300" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {t('profile.signInRequiredTitle')}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('profile.signInRequiredDescription')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => presenter.auth.openAuthModal('login')}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 transition-all min-w-[120px]"
            >
              {t('common.signIn')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const pinnedSet = new Set(pinnedIds);
  const pinnedProjects = pinnedIds
    .map((id) => myProjects.find((p) => p.id === id))
    .filter((p): p is (typeof myProjects)[number] => !!p);
  const unpinnedProjects = myProjects.filter((p) => !pinnedSet.has(p.id));

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6 md:space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-brand-500 to-purple-600 flex items-center justify-center text-lg font-semibold text-white">
            {(user.displayName || user.email || 'U').toUpperCase().charAt(0)}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {t('profile.title')}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('profile.yourCommunityProfile')}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={presenter.myProfile.openPublicProfile}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Share2 className="w-4 h-4" />
            {t('profile.viewPublicProfile')}
          </button>
          <button
            type="button"
            onClick={() => presenter.myProfile.copyPublicUrl(copyToClipboard)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            {t('profile.copyProfileLink')}
          </button>
        </div>
      </div>

      {/* Top grid: About + Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 glass-card rounded-xl p-5 border border-slate-200 dark:border-slate-800">
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              {t('profile.handleLabel', 'Profile handle')}
            </label>
            <input
              type="text"
              value={handleInput}
              onChange={(e) => presenter.myProfile.validateHandle(e.target.value)}
              placeholder={t('profile.handlePlaceholder', 'e.g. peiwang')}
              className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/60 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {t('profile.handleHint', 'Your public URL will be')}:{' '}
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {window.location.origin}/u/
                {encodeURIComponent(
                  handleInput.trim() || user.handle || user.id,
                )}
              </span>
            </p>
            {handleError && (
              <p className="mt-1 text-[11px] text-red-500 dark:text-red-400">
                {handleError}
              </p>
            )}
          </div>

          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">
            {t('profile.about')}
          </h3>
          <textarea
            value={bio}
            onChange={(e) => actions.setBio(e.target.value)}
            placeholder={t('profile.bioPlaceholder')}
            rows={4}
            className="w-full resize-none text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/60 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                {t('profile.links')}
              </label>
              <button
                type="button"
                onClick={actions.addLink}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300"
              >
                <Plus className="w-3.5 h-3.5" />
                {t('profile.addLink')}
              </button>
            </div>
            {links.length === 0 ? (
              <div className="text-xs text-slate-500 dark:text-slate-400 py-2">
                {t('profile.linksEmptyHint')}
              </div>
            ) : (
              <div className="space-y-2">
                {links.map((link, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={link.url}
                      onChange={(e) => actions.updateLink(index, 'url', e.target.value)}
                      placeholder={t('profile.linkUrlPlaceholder')}
                      className="flex-1 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/60 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                    <button
                      type="button"
                      onClick={() => actions.removeLink(index)}
                      className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      title={t('profile.removeLink')}
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => actions.moveLink(index, 'up')}
                        className="inline-flex items-center justify-center w-7 h-4 rounded border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
                        disabled={index === 0}
                        title={t('profile.moveLinkUp', 'Move up')}
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => actions.moveLink(index, 'down')}
                        className="inline-flex items-center justify-center w-7 h-4 rounded border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
                        disabled={index === links.length - 1}
                        title={t('profile.moveLinkDown', 'Move down')}
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="glass-card rounded-xl p-5 border border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">
            {t('profile.communityStats')}
          </h3>
          {isLoading || !profileData ? (
            <div className="space-y-3">
              <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">
                  {t('profile.publicApps')}
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {profileData.stats.publicProjectsCount}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">
                  {t('profile.totalLikes')}
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {profileData.stats.totalLikes}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">
                  {t('profile.totalFavorites')}
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {profileData.stats.totalFavorites}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pinned apps */}
      {pinnedProjects.length > 0 && (
        <div className="glass-card rounded-xl p-5 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {t('profile.pinnedApps')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('profile.pinnedAppsDescription')}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pinnedProjects.map((project) => (
              <div
                key={project.id}
                draggable
                onDragStart={(e) => handlePinnedDragStart(e, project.id)}
                onDragOver={(e) => handlePinnedDragOver(e, project.id)}
                onDrop={(e) => handlePinnedDrop(e, project.id)}
                onDragEnd={presenter.myProfile.handlePinnedDragEnd}
                className={`flex items-start gap-3 rounded-lg border px-3 py-2 transition-all cursor-move border-brand-500/60 bg-brand-50 dark:bg-brand-900/20 ${
                  draggingPinnedId === project.id
                    ? 'opacity-80 ring-1 ring-brand-500/60'
                    : ''
                }`}
              >
                <GripVertical className="mt-1 w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                    {project.name}
                  </div>
                  {project.description && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                      {project.description}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    actions.togglePinned(project.id);
                  }}
                  className="flex items-center gap-1 flex-shrink-0 hover:opacity-80"
                  title={t('profile.pinnedApps')}
                >
                  <Pin className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unpinned apps */}
      {unpinnedProjects.length > 0 && (
        <div className="glass-card rounded-xl p-5 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {t('profile.allApps')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('profile.clickToPin')}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {unpinnedProjects.map((project) => (
              <div
                key={project.id}
                className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2 border-slate-200 dark:border-slate-700"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                    {project.name}
                  </div>
                  {project.description && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                      {project.description}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => actions.togglePinned(project.id)}
                  className="flex items-center gap-1 flex-shrink-0 hover:opacity-80 transition-opacity"
                  title={t('profile.pinnedApps')}
                >
                  <PinOff className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {myProjects.length === 0 && (
        <div className="glass-card rounded-xl p-5 border border-slate-200 dark:border-slate-800">
          <div className="text-sm text-slate-500 dark:text-slate-400 py-4">
            <p className="font-medium mb-1">{t('profile.noPublicApps')}</p>
            <p className="text-xs">{t('profile.noPublicAppsHint')}</p>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={presenter.myProfile.saveProfile}
          disabled={isSaving || !!handleError}
          className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSaving ? t('common.loading') : t('profile.saveProfile')}
        </button>
      </div>
    </div>
  );
};
