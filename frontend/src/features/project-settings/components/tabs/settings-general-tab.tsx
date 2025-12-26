import React from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { usePresenter } from '@/contexts/presenter-context';
import { ProjectSettingsPublicUrlSection } from '@/features/project-settings/components/project-settings-public-url-section';
import { ProjectSettingsBasicInfoGroup } from '@/features/project-settings/components/project-settings-basic-info-group';
import { getProjectLiveUrl } from '@/utils/project';
import type { Project } from '@/types';

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

    // Compute project URL - prefer canonical URL with provider fallback
    const projectUrl = getProjectLiveUrl(project);

    // Visibility state
    const showInExplore = project.isPublic ?? true;
    const isExtensionSupported = project.isExtensionSupported ?? false;
    const canEnableExtensionSupport = (() => {
        if (!projectUrl) return false;
        try {
            const host = new URL(projectUrl).hostname;
            return host.endsWith('.gemigo.app');
        } catch {
            return false;
        }
    })();

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Main Settings Card - Clean List Style */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">

                {/* Section: Public URL */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                    <ProjectSettingsPublicUrlSection projectUrl={projectUrl} />
                </div>

                {/* Section: Basic Info */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                    <ProjectSettingsBasicInfoGroup project={project} />
                </div>

                {/* Section: Visibility */}
                <div className="p-6">
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                                {t('project.showInExplore', 'Show in Explore')}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {t('project.showInExploreDescription', 'Make this project discoverable in the public Explore feed.')}
                            </p>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={showInExplore}
                            onClick={presenter.projectSettings.togglePublicVisibility}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showInExplore
                                ? 'bg-brand-500'
                                : 'bg-slate-200 dark:bg-slate-700'
                                }`}
                            title={t('project.togglePublicVisibility')}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${showInExplore ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>
                </div>

                {/* Section: Browser Extension */}
                <div className="p-6 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                                {t('project.enableInExtension', 'Enable in Browser Extension')}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {canEnableExtensionSupport
                                    ? t(
                                        'project.enableInExtensionDescription',
                                        'Allow this project to appear in the browser extension Explore list.',
                                    )
                                    : t(
                                        'project.enableInExtensionRequiresGemigoApp',
                                        'Requires a live URL under https://*.gemigo.app to run inside the extension.',
                                    )}
                            </p>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={isExtensionSupported}
                            disabled={!canEnableExtensionSupport}
                            onClick={presenter.projectSettings.toggleExtensionSupport}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isExtensionSupported
                                ? 'bg-brand-500'
                                : 'bg-slate-200 dark:bg-slate-700'
                                } ${canEnableExtensionSupport ? '' : 'opacity-50 cursor-not-allowed'}`}
                            title={t('project.toggleExtensionSupport', 'Toggle extension support')}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${isExtensionSupported ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>
                </div>
            </div>

            {/* Danger Zone - Separate Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-red-200 dark:border-red-900/50 overflow-hidden">
                <div className="px-6 py-4 border-b border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-950/20">
                    <h2 className="text-base font-semibold text-red-700 dark:text-red-400">
                        {t('project.dangerZone', 'Danger Zone')}
                    </h2>
                </div>
                <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h3 className="text-sm font-medium text-slate-900 dark:text-white">
                            {t('project.deleteProject', 'Delete Project')}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            {t('project.deleteDescription', 'Permanently remove this project and all of its data.')}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onDeleteProject}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white dark:hover:bg-red-500 transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                        {t('project.deleteProject', 'Delete Project')}
                    </button>
                </div>
            </div>
        </div>
    );
};
