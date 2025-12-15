import React from 'react';
import { useTranslation } from 'react-i18next';
import { ProjectSettingsThumbnailSection } from './project-settings-thumbnail-section';
import type { Project } from '@/types';

interface ProjectSettingsDisplayGroupProps {
  project: Project;
}

export const ProjectSettingsDisplayGroup: React.FC<
  ProjectSettingsDisplayGroupProps
> = ({ project }) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
          {t('project.displaySettings')}
        </h2>
        <ProjectSettingsThumbnailSection project={project} />
      </div>
    </div>
  );
};
