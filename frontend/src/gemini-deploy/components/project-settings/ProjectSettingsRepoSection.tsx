import React from 'react';
import { ExternalLink, GitBranch, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ProjectSettingsProject } from './types';

interface ProjectSettingsRepoSectionProps {
  project: ProjectSettingsProject;
  repoLabel: string;
  repoUrlDraft: string;
  onRepoUrlChange: (value: string) => void;
  onSaveRepoUrl: () => void;
  isSavingRepoUrl: boolean;
}

export const ProjectSettingsRepoSection: React.FC<
  ProjectSettingsRepoSectionProps
> = ({
  project,
  repoLabel,
  repoUrlDraft,
  onRepoUrlChange,
  onSaveRepoUrl,
  isSavingRepoUrl,
}) => {
  const { t } = useTranslation();

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
        {t('project.repository')}
      </h3>
      <div className="space-y-2">
        <div className="relative">
          <input
            type="text"
            value={repoUrlDraft}
            onChange={(e) => onRepoUrlChange(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="w-full pr-24 pl-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
          <button
            onClick={onSaveRepoUrl}
            disabled={isSavingRepoUrl}
            className="absolute inset-y-1.5 right-1.5 px-3 text-xs font-semibold rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50"
          >
            <Save className="w-3 h-3 inline-block mr-1" />
            {t('common.save')}
          </button>
        </div>
        <p className="text-xs text-slate-500 dark:text-gray-400">
          {t('project.repoUrlDescription')}
        </p>
        {project.repoUrl && (
          <a
            href={project.repoUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-gray-300 hover:text-brand-500 dark:hover:text-brand-400"
          >
            <GitBranch className="w-3 h-3" />
            {repoLabel}
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
};

