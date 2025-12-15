import React from 'react';
import { useTranslation } from 'react-i18next';
import { ProjectSettingsMetadataSection } from './project-settings-metadata-section';
import type { Project } from '@/types';

interface ProjectSettingsBasicInfoGroupProps {
  project: Project;
}

export const ProjectSettingsBasicInfoGroup: React.FC<
  ProjectSettingsBasicInfoGroupProps
> = ({ project }) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
          {t('project.basicInfo')}
        </h2>
        <div className="space-y-6">
          <ProjectSettingsMetadataSection project={project} />
        </div>
      </div>
    </div>
  );
};
