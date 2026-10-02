import React from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectStore } from '@/stores/project.store';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { useMyProfileStore } from '@/features/profile/stores/my-profile.store';
import { usePresenter } from '@/contexts/presenter-context';
import { SessionError } from '@/components/session-error';
import { ContentSkeleton } from '@/components/loading-state';
import { PageState } from '@/components/page-state';
import { ProfileLayout } from '@/features/profile/components/profile-layout';
import { ProfileLoadingState } from '@/features/profile/components/my-profile/profile-loading-state';
import { ProfileSignInRequired } from '@/features/profile/components/my-profile/profile-sign-in-required';
import { ProfileAboutStats } from '@/features/profile/components/my-profile/profile-about-stats';
import { ProfilePinnedProjects } from '@/features/profile/components/my-profile/profile-pinned-projects';
import { ProfileAllProjects } from '@/features/profile/components/my-profile/profile-all-projects';

export const MyProfile: React.FC = () => {
  const { t } = useTranslation();
  const presenter = usePresenter();
  const sessionError = useAuthStore((s) => s.sessionError);
  const hasLoaded = useProjectStore((s) => s.hasLoaded);
  const loadError = useProjectStore((s) => s.loadError);
  const user = useAuthStore((s) => s.user);
  const isLoadingAuth = useAuthStore((s) => s.isLoading);

  const profileLoading = useMyProfileStore((s) => s.isLoading);
  const profileData = useMyProfileStore((s) => s.profileData);
  const profileError = useMyProfileStore((s) => s.loadError);
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

  if (sessionError) return <ProfileLayout><SessionError /></ProfileLayout>;
  if (user && !hasLoaded) return <ProfileLayout>{loadError
    ? <PageState title={t('experience.projectsError')} action={<button className="btn-primary" onClick={() => { void presenter.project.loadProjects(); }}>{t('common.retry')}</button>} />
    : <ContentSkeleton shape="profile" />}</ProfileLayout>;
  if (user && profileError) return <ProfileLayout><PageState title={t('experience.profileError')} action={<button className="btn-primary" onClick={() => { void presenter.myProfile.loadProfile(); }}>{t('common.retry')}</button>} /></ProfileLayout>;
  if (user && (profileLoading || !profileData || profileData.user.id !== user.id)) return <ProfileLoadingState />;
  if (!user) {
    return <ProfileSignInRequired />;
  }

  return (
    <ProfileLayout>
      <div className="space-y-6 md:space-y-8 ">
        <ProfileAboutStats />
        <ProfilePinnedProjects />
        <ProfileAllProjects />

        <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={presenter.myProfile.saveProfile}
            disabled={isSaving || profileLoading || !!handleError || !!profileError}
            className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
          >
            {isSaving ? t('common.loading') : t('profile.saveProfile')}
          </button>
        </div>
      </div>
    </ProfileLayout>
  );
};
