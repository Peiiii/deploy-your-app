import React from 'react';
import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatRelativeTime } from '../../utils/date';
import type { Project } from '../../types';

interface ProjectSettingsHeaderProps {
  project: Project;
}

export const ProjectSettingsHeader: React.FC<ProjectSettingsHeaderProps> = ({
  project,
}) => {
  const { t } = useTranslation();

  const formattedDate = formatRelativeTime(project.lastDeployed, {
    justNow: t('common.justNow'),
    minutesAgo: t('common.minutesAgo'),
    hoursAgo: t('common.hoursAgo'),
    daysAgo: t('common.daysAgo'),
  });

  return (
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
      <div className="flex items-start gap-4 flex-1 min-w-0">
        <div className="w-14 h-14 rounded-xl flex items-center justify-center border shadow-inner bg-gradient-to-br from-blue-500/10 to-purple-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 flex-shrink-0">
          <span className="font-bold text-base tracking-tighter">
            {project.framework.slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
            {project.name}
          </h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {project.category && (
              <span className="text-xs px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-gray-400">
                {project.category}
              </span>
            )}
            {project.tags && project.tags.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                {project.tags.slice(0, 3).map((tag, idx) => (
                  <span
                    key={idx}
                    className="text-xs px-2 py-1 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400"
                  >
                    {tag}
                  </span>
                ))}
                {project.tags.length > 3 && (
                  <span className="text-xs text-slate-500 dark:text-gray-400">
                    +{project.tags.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-col items-start md:items-end gap-2 text-xs flex-shrink-0">
        <div
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border uppercase tracking-wider font-semibold text-xs ${
            project.status === 'Live'
              ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
              : project.status === 'Failed'
                ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              project.status === 'Live'
                ? 'bg-green-500 dark:bg-green-400 animate-pulse'
                : project.status === 'Failed'
                  ? 'bg-red-500 dark:bg-red-400'
                  : 'bg-yellow-500 dark:bg-yellow-400'
            }`}
          />
          {project.status}
        </div>
        <div className="flex items-center gap-1.5 text-slate-500 dark:text-gray-400">
          <Clock className="w-3.5 h-3.5" />
          <span>{t('project.lastDeploy')}:</span>
          <span className="font-medium">{formattedDate}</span>
        </div>
      </div>
    </div>
  );
};

