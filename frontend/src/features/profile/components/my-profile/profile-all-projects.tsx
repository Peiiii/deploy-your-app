import React from 'react';
import { useTranslation } from 'react-i18next';
import { PinOff } from 'lucide-react';
import { useMyProfileStore } from '@/features/profile/stores/my-profile-store';
import { usePresenter } from '@/contexts/presenter-context';

export const ProfileAllProjects: React.FC = () => {
    const { t } = useTranslation();
    const presenter = usePresenter();

    const pinnedIds = useMyProfileStore((s) => s.pinnedIds);
    const actions = useMyProfileStore((s) => s.actions);

    const myProjects = presenter.myProfile.getMyProjects();
    const pinnedSet = new Set(pinnedIds);
    const unpinnedProjects = myProjects.filter((p) => !pinnedSet.has(p.id));

    if (unpinnedProjects.length === 0) {
        if (myProjects.length === 0) {
            return (
                <div className="glass-card rounded-xl p-5 border border-slate-200 dark:border-slate-800">
                    <div className="text-sm text-slate-500 dark:text-slate-400 py-4">
                        <p className="font-medium mb-1">{t('profile.noPublicApps')}</p>
                        <p className="text-xs">{t('profile.noPublicAppsHint')}</p>
                    </div>
                </div>
            );
        }
        return null;
    }

    return (
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
    );
};
