import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';
import { useProjectStore } from '../stores/projectStore';
import { usePresenter } from '../contexts/PresenterContext';
import type { PublicUserProfile, ProfileLink } from '../types';
import { fetchPublicProfile, updateMyProfile } from '../services/http/profileApi';
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
  const allProjects = useProjectStore((s) => s.projects);

  const [profileData, setProfileData] = React.useState<PublicUserProfile | null>(null);
  const [bio, setBio] = React.useState('');
  const [links, setLinks] = React.useState<ProfileLink[]>([]);
  const [handleInput, setHandleInput] = React.useState('');
  const [handleError, setHandleError] = React.useState<string | null>(null);
  const [draggingPinnedId, setDraggingPinnedId] = React.useState<string | null>(null);
  const [pinnedIds, setPinnedIds] = React.useState<string[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const myProjects = React.useMemo(
    () => (user ? allProjects.filter((p) => p.ownerId === user.id && p.isPublic !== false) : []),
    [allProjects, user],
  );

  React.useEffect(() => {
    if (!user) return;
    setHandleInput(user.handle ?? '');
    setHandleError(null);
    setIsLoading(true);
    void fetchPublicProfile(user.id)
      .then((data) => {
        setProfileData(data);
        setBio(data.profile.bio ?? '');

        const allLinks = (data.profile.links ?? []).filter(
          (l) => typeof l.url === 'string' && l.url.trim().length > 0,
        );
        setLinks(allLinks);
        setPinnedIds(data.profile.pinnedProjectIds ?? []);
      })
      .catch((err) => {
        console.error('Failed to load profile', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [user]);

  const handleTogglePinned = (projectId: string) => {
    setPinnedIds((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId],
    );
  };

  const handleAddLink = () => {
    setLinks((prev) => [...prev, { label: null, url: '' }]);
  };

  const handleRemoveLink = (index: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateLink = (index: number, field: 'url' | 'label', value: string) => {
    setLinks((prev) =>
      prev.map((link, i) =>
        i === index ? { ...link, [field]: value || null } : link,
      ),
    );
  };

  const handleMoveLink = (index: number, direction: 'up' | 'down') => {
    setLinks((prev) => {
      const next = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) {
        return prev;
      }
      const temp = next[targetIndex];
      next[targetIndex] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const handlePinnedDragStart = (e: React.DragEvent, projectId: string) => {
    e.stopPropagation();
    setDraggingPinnedId(projectId);
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
    if (!draggingPinnedId || draggingPinnedId === projectId) {
      setDraggingPinnedId(null);
      return;
    }
    if (!pinnedIds.includes(projectId)) {
      setDraggingPinnedId(null);
      return;
    }
    setPinnedIds((prev) => {
      const current = prev.slice();
      if (!current.includes(draggingPinnedId)) return prev;
      const without = current.filter((id) => id !== draggingPinnedId);
      const targetIndex = without.indexOf(projectId);
      if (targetIndex === -1) return prev;
      without.splice(targetIndex, 0, draggingPinnedId);
      return without;
    });
    setDraggingPinnedId(null);
  };

  const handlePinnedDragEnd = () => {
    setDraggingPinnedId(null);
  };

  const handleSave = async () => {
    if (!user) return;
    if (handleError) {
      presenter.ui.showErrorToast(handleError);
      return;
    }
    setIsSaving(true);
    try {
      const trimmedHandle = handleInput.trim();
      if (trimmedHandle && trimmedHandle !== (user.handle ?? '')) {
        await presenter.auth.updateHandle(trimmedHandle);
      }
      const validLinks = links
        .filter((l) => l.url && l.url.trim().length > 0)
        .map((l) => ({
          label: l.label && l.label.trim().length > 0 ? l.label.trim() : null,
          url: l.url.trim(),
        }));

      const nextProfile = await updateMyProfile({
        bio,
        links: validLinks,
        pinnedProjectIds: pinnedIds,
      });

      setProfileData((current) =>
        current
          ? { ...current, profile: nextProfile }
          : null,
      );
      setLinks(validLinks);
      presenter.ui.showSuccessToast(t('profile.updateSuccess'));
    } catch (error) {
      console.error('Failed to update profile', error);
      if (error instanceof Error) {
        setHandleError(error.message);
        presenter.ui.showErrorToast(error.message);
      } else {
        presenter.ui.showErrorToast(t('profile.updateError'));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyPublicUrl = async () => {
    if (!user) return;
    try {
      const identifier =
        user.handle && user.handle.trim().length > 0
          ? user.handle.trim()
          : user.id;
      const url = `${window.location.origin}/u/${encodeURIComponent(
        identifier,
      )}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      presenter.ui.showSuccessToast(t('profile.profileLinkCopied'));
    } catch (err) {
      console.error('Failed to copy profile link', err);
    }
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
            onClick={() => {
              const identifier =
                user.handle && user.handle.trim().length > 0
                  ? user.handle.trim()
                  : user.id;
              window.open(
                `/u/${encodeURIComponent(identifier)}`,
                '_blank',
                'noopener,noreferrer',
              );
            }}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Share2 className="w-4 h-4" />
            {t('profile.viewPublicProfile')}
          </button>
          <button
            type="button"
            onClick={handleCopyPublicUrl}
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
              onChange={(e) => {
                const value = e.target.value;
                setHandleInput(value);
                const trimmed = value.trim();
                if (!trimmed) {
                  setHandleError(null);
                  return;
                }
                if (trimmed.length < 3 || trimmed.length > 24) {
                  setHandleError(
                    t(
                      'profile.handleErrorLength',
                      'Handle must be 3–24 characters.',
                    ),
                  );
                  return;
                }
                if (!/^[a-z0-9-]+$/.test(trimmed)) {
                  setHandleError(
                    t(
                      'profile.handleErrorCharset',
                      'Handle can only contain lowercase letters, numbers and dashes.',
                    ),
                  );
                  return;
                }
                setHandleError(null);
              }}
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
            onChange={(e) => setBio(e.target.value)}
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
                onClick={handleAddLink}
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
                      onChange={(e) => handleUpdateLink(index, 'url', e.target.value)}
                      placeholder={t('profile.linkUrlPlaceholder')}
                      className="flex-1 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/60 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveLink(index)}
                      className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      title={t('profile.removeLink')}
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveLink(index, 'up')}
                        className="inline-flex items-center justify-center w-7 h-4 rounded border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
                        disabled={index === 0}
                        title={t('profile.moveLinkUp', 'Move up')}
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveLink(index, 'down')}
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
      {(() => {
        const pinnedSet = new Set(pinnedIds);
        const pinnedProjects = pinnedIds
          .map((id) => myProjects.find((p) => p.id === id))
          .filter((p): p is (typeof myProjects)[number] => !!p);
        const unpinnedProjects = myProjects.filter((p) => !pinnedSet.has(p.id));

        return (
          <>
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
                      onDragEnd={handlePinnedDragEnd}
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
                          handleTogglePinned(project.id);
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
                        onClick={() => handleTogglePinned(project.id)}
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
          </>
        );
      })()}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !!handleError}
          className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSaving ? t('common.loading') : t('profile.saveProfile')}
        </button>
      </div>
    </div>
  );
};
