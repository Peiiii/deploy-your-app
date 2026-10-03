import { useTranslation } from 'react-i18next';
import { Pin } from 'lucide-react';
import { IconButton } from '@/components/icon-button';
import { useMyProfileStore } from '@/features/profile/stores/my-profile.store';
import { usePresenter } from '@/contexts/presenter-context';
import { CreatorProjectCard } from '@/features/profile/components/creator-project-card';

export function ProfileAllProjects() {
  const { t } = useTranslation();
  const presenter = usePresenter();
  const { pinnedIds, actions } = useMyProfileStore();
  const projects = presenter.myProfile.getMyProjects();
  const others = projects.filter((project) => !pinnedIds.includes(project.id));
  if (!projects.length)
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center dark:border-slate-700">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {t('profile.noPublicApps')}
        </p>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {t('profile.noPublicAppsHint')}
        </p>
      </div>
    );
  if (!others.length) return null;
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500 dark:text-slate-400">{t('profile.clickToPin')}</p>
      <div className="creator-grid">
        {others.map((project, index) => (
          <CreatorProjectCard
            key={project.id}
            project={project}
            priority={index < 3 && !pinnedIds.length}
            actions={
              <IconButton
                label={t('navigation.pinProject')}
                size="sm"
                onClick={() => actions.togglePinned(project.id)}
                className="text-slate-400 hover:text-brand-500"
              >
                <Pin className="h-4 w-4" />
              </IconButton>
            }
          />
        ))}
      </div>
    </div>
  );
}
