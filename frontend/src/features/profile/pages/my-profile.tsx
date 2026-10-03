import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutGrid } from 'lucide-react';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { useMyProfileStore } from '@/features/profile/stores/my-profile.store';
import { usePresenter } from '@/contexts/presenter-context';
import { ProfileLayout } from '@/features/profile/components/profile-layout';
import { ProfileLoadingState } from '@/features/profile/components/my-profile/profile-loading-state';
import { ProfileSignInRequired } from '@/features/profile/components/my-profile/profile-sign-in-required';
import { ProfileEditor } from '@/features/profile/components/my-profile/profile-editor';
import { ProfilePinnedProjects } from '@/features/profile/components/my-profile/profile-pinned-projects';
import { ProfileAllProjects } from '@/features/profile/components/my-profile/profile-all-projects';

export function MyProfile() {
  const { t } = useTranslation();
  const presenter = usePresenter();
  const user = useAuthStore((s) => s.user);
  const userId = user?.id;
  const isLoadingAuth = useAuthStore((s) => s.isLoading);
  const { handleError, loadError, isSaving, isLoading, profileData } = useMyProfileStore();
  useEffect(() => {
    if (userId) void presenter.myProfile.loadProfile();
  }, [userId, presenter.myProfile]);
  if (
    isLoadingAuth ||
    (user && (isLoading || ((!profileData || profileData.user.id !== user.id) && !loadError)))
  )
    return <ProfileLoadingState />;
  if (!user) return <ProfileSignInRequired />;
  if (loadError)
    return (
      <div className="mx-auto max-w-xl p-8 text-center">
        <p className="text-slate-500 dark:text-slate-400">{t('profile.loadFailed')}</p>
        <button
          type="button"
          onClick={presenter.myProfile.loadProfile}
          className="mt-4 rounded-xl bg-brand-600 px-5 py-3 text-sm text-white"
        >
          {t('common.retry')}
        </button>
      </div>
    );
  return (
    <ProfileLayout>
      <details className="creator-editor overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <summary className="cursor-pointer px-5 py-5 text-sm font-semibold text-slate-800 hover:text-brand-600 focus-visible:outline-brand-500 dark:text-slate-100 sm:px-6">
          {t('profile.editProfile')}
          <span className="ml-3 hidden text-xs font-normal text-slate-500 sm:inline">
            {t('profile.editProfileHint')}
          </span>
        </summary>
        <div className="p-5 sm:p-6">
          <ProfileEditor />
        </div>
      </details>
      <section className="space-y-5">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
          <LayoutGrid className="h-5 w-5 text-brand-500" aria-hidden="true" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('profile.works')}</h2>
          <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-600 dark:bg-brand-950 dark:text-brand-300">
            {profileData?.projects.length ?? 0}
          </span>
        </div>
        <ProfilePinnedProjects />
        <ProfileAllProjects />
      </section>
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
        <p className="text-xs text-slate-500 dark:text-slate-400">{t('profile.editingDraft')}</p>
        <button
          type="button"
          onClick={presenter.myProfile.saveProfile}
          disabled={isSaving || !!handleError || !profileData}
          className="rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? t('common.loading') : t('profile.saveProfile')}
        </button>
      </div>
    </ProfileLayout>
  );
}
