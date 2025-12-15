import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { useMyProfileStore } from '@/features/profile/stores/my-profile-store';
import { usePresenter } from '@/contexts/presenter-context';
import { ProfileLoadingState } from '@/features/profile/components/my-profile/profile-loading-state';
import { ProfileSignInRequired } from '@/features/profile/components/my-profile/profile-sign-in-required';
import { ProfileHeader } from '@/features/profile/components/my-profile/profile-header';
import { ProfileAboutStats } from '@/features/profile/components/my-profile/profile-about-stats';
import { ProfilePinnedProjects } from '@/features/profile/components/my-profile/profile-pinned-projects';
import { ProfileAllProjects } from '@/features/profile/components/my-profile/profile-all-projects';

export const MyProfile: React.FC = () => {
  const { t } = useTranslation();
  const presenter = usePresenter();
  const user = useAuthStore((s) => s.user);
  const isLoadingAuth = useAuthStore((s) => s.isLoading);

  const handleError = useMyProfileStore((s) => s.handleError);
  const isSaving = useMyProfileStore((s) => s.isSaving);

  // Load profile on mount
  React.useEffect(() => {
    if (user) {
      presenter.myProfile.loadProfile();
    }
  }, [user, presenter.myProfile]);

  if (isLoadingAuth) {
    return <ProfileLoadingState />;
  }

  if (!user) {
    return <ProfileSignInRequired />;
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6 md:space-y-8 animate-fade-in">
      <ProfileHeader />
      <ProfileAboutStats />
      <ProfilePinnedProjects />
      <ProfileAllProjects />

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
