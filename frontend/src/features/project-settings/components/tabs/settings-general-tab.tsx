import React from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { usePresenter } from '@/contexts/presenter-context';
import { ProjectSettingsBasicInfoGroup } from '@/features/project-settings/components/project-settings-basic-info-group';
import type { Project } from '@/types';
import { ProjectSettingsPublicUrlSection } from '@/features/project-settings/components/project-settings-public-url-section';

interface SettingsGeneralTabProps {
    project: Project;
    onDeleteProject: () => void;
}

export const SettingsGeneralTab: React.FC<SettingsGeneralTabProps> = ({
    project,
    onDeleteProject,
}) => {
    const { t } = useTranslation();
    const presenter = usePresenter();

    const showInExplore = project.isPublic ?? true;

    return (
        <div className="space-y-8 animate-fade-in">
            {/* 1. Public Link (Moved here as it is general info) */}
            <div className="glass-card rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
                <ProjectSettingsPublicUrlSection projectUrl={project.url} />
            </div>

            {/* 2. Basic Info */}
            <div className="glass-card rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
                <ProjectSettingsBasicInfoGroup project={project} />
            </div>

            {/* 3. Visibility */}
            <div className="glass-card rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
                    {t('project.visibility', 'Project Visibility')}
                </h3>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                            {t('project.showInExplore')}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            {t('project.showInExploreDescription')}
                        </p>
                    </div>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={showInExplore}
                        onClick={presenter.projectSettings.togglePublicVisibility}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${showInExplore
                                ? 'bg-brand-500 border-brand-500'
                                : 'bg-slate-200 dark:bg-slate-700 border-transparent'
                            }`}
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${showInExplore ? 'translate-x-6' : 'translate-x-1'
                                }`}
                        />
                    </button>
                </div>
            </div>

            {/* 4. Danger Zone */}
            <div className="glass-card rounded-2xl p-6 border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/10">
                <h3 className="text-base font-semibold text-red-600 dark:text-red-400 mb-4">
                    {t('project.dangerZone')}
                </h3>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                            {t('project.deleteProject')}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            {t('project.deleteDescription')}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onDeleteProject}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                    >
                        <Trash2 className="w-4 h-4" />
                        {t('project.deleteProject')}
                    </button>
                </div>
            </div>
        </div>
    );
};
