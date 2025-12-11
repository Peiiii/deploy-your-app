import React from 'react';
import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ProjectSettingsProject } from './types';

interface ProjectSettingsHeaderProps {
  project: ProjectSettingsProject;
}

export const ProjectSettingsHeader: React.FC<ProjectSettingsHeaderProps> = ({
  project,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center border shadow-inner bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
          <span className="font-bold text-sm tracking-tighter">
            {project.framework.slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            {project.name}
          </h1>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
            {project.category || 'Other'} ·{' '}
            {project.tags && project.tags.length > 0
              ? project.tags.join(', ')
              : 'No tags'}
          </p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 text-xs">
        <div
          className={`inline-flex items-center gap-2 px-2 py-1 rounded-full border uppercase tracking-wider font-bold ${
            project.status === 'Live'
              ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
              : project.status === 'Failed'
                ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              project.status === 'Live'
                ? 'bg-green-500 dark:bg-green-400 animate-pulse'
                : project.status === 'Failed'
                  ? 'bg-red-500 dark:bg-red-400'
                  : 'bg-yellow-500 dark:bg-yellow-400'
            }`}
          />
          {project.status}
        </div>
        <div className="flex items-center gap-1 text-slate-500 dark:text-gray-400">
          <Clock className="w-3 h-3" /> {t('project.lastDeploy')}:{' '}
          {project.lastDeployed}
        </div>
      </div>
    </div>
  );
};

