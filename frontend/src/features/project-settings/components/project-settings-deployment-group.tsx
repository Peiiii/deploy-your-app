import React from 'react';
import { useTranslation } from 'react-i18next';
import { ProjectSettingsRedeploySection } from './project-settings-redeploy-section';
import type { Project } from '@/types';

interface ProjectSettingsDeploymentGroupProps {
  project: Project;
  canDeployFromGitHub: boolean;
}

export const ProjectSettingsDeploymentGroup: React.FC<
  ProjectSettingsDeploymentGroupProps
> = ({ project, canDeployFromGitHub }) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
          {t('project.deploymentManagement')}
        </h2>
        <ProjectSettingsRedeploySection
          project={project}
          canDeployFromGitHub={canDeployFromGitHub}
        />
      </div>
    </div>
  );
};
