import React from 'react';
import { useTranslation } from 'react-i18next';
import { ProjectSettingsRedeploySection } from './ProjectSettingsRedeploySection';

interface ProjectSettingsDeploymentGroupProps {
  canRedeployFromGitHub: boolean;
  isRedeploying: boolean;
  isDeploymentInProgress: boolean;
  onRedeployFromGitHub: () => void;
  zipUploading: boolean;
  onZipInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ProjectSettingsDeploymentGroup: React.FC<
  ProjectSettingsDeploymentGroupProps
> = ({
  canRedeployFromGitHub,
  isRedeploying,
  isDeploymentInProgress,
  onRedeployFromGitHub,
  zipUploading,
  onZipInputChange,
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
          {t('project.deploymentManagement')}
        </h2>
        <ProjectSettingsRedeploySection
          canRedeployFromGitHub={canRedeployFromGitHub}
          isRedeploying={isRedeploying}
          isDeploymentInProgress={isDeploymentInProgress}
          onRedeployFromGitHub={onRedeployFromGitHub}
          zipUploading={zipUploading}
          onZipInputChange={onZipInputChange}
        />
      </div>
    </div>
  );
};
