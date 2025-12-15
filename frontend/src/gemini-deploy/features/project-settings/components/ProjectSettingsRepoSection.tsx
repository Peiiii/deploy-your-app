import React from 'react';
import { GitBranch, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePresenter } from '@/contexts/PresenterContext';
import { useProjectSettingsStore } from '@/stores/projectSettingsStore';
import { formatRepoLabel } from '@/utils/project';
import type { Project } from '@/types';

interface ProjectSettingsRepoSectionProps {
  project: Project;
}

export const ProjectSettingsRepoSection: React.FC<
  ProjectSettingsRepoSectionProps
> = ({ project }) => {
  const { t } = useTranslation();
  const presenter = usePresenter();

  // Subscribe to store state individually
  const repoUrlDraft = useProjectSettingsStore((s) => s.repoUrlDraft);
  const isSavingRepoUrl = useProjectSettingsStore((s) => s.isSavingRepoUrl);
  const actions = useProjectSettingsStore((s) => s.actions);

  const repoLabel = formatRepoLabel(project);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
        <GitBranch className="w-4 h-4 text-slate-500" />
        {t('project.repository')}
      </h3>
      {repoLabel && (
        <p className="text-xs text-slate-600 dark:text-gray-400">
          {t('project.currentRepo')}: <span className="font-mono">{repoLabel}</span>
        </p>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={repoUrlDraft}
          onChange={(e) => actions.setRepoUrlDraft(e.target.value)}
          className="flex-1 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all"
          placeholder={t('project.repoUrlPlaceholder')}
        />
        <button
          onClick={presenter.projectSettings.saveRepoUrl}
          disabled={isSavingRepoUrl}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm hover:shadow"
        >
          <Save className={`w-3 h-3 ${isSavingRepoUrl ? 'animate-pulse' : ''}`} />
          {isSavingRepoUrl ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </div>
  );
};
