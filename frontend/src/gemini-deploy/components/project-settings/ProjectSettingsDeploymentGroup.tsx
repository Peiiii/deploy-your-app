import React from 'react';
import { useTranslation } from 'react-i18next';
import { ProjectSettingsRedeploySection } from './ProjectSettingsRedeploySection';

interface ProjectSettingsDeploymentGroupProps {
  hasDeployedBefore: boolean;
  canDeployFromGitHub: boolean;
  isRedeploying: boolean;
  isDeploymentInProgress: boolean;
  onRedeployFromGitHub: () => void;
  canDeployFromZip: boolean;
  zipUploading: boolean;
  onZipInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  hasSavedHtml: boolean;
  isDeployingHtml: boolean;
  onDeployFromHtml: () => void;
  htmlUploading: boolean;
  onHtmlInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ProjectSettingsDeploymentGroup: React.FC<
  ProjectSettingsDeploymentGroupProps
> = ({
  hasDeployedBefore,
  canDeployFromGitHub,
  isRedeploying,
  isDeploymentInProgress,
  onRedeployFromGitHub,
  canDeployFromZip,
  zipUploading,
  onZipInputChange,
  hasSavedHtml,
  isDeployingHtml,
  onDeployFromHtml,
  htmlUploading,
  onHtmlInputChange,
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
          {t('project.deploymentManagement')}
        </h2>
        <ProjectSettingsRedeploySection
          hasDeployedBefore={hasDeployedBefore}
          canDeployFromGitHub={canDeployFromGitHub}
          isRedeploying={isRedeploying}
          isDeploymentInProgress={isDeploymentInProgress}
          onRedeployFromGitHub={onRedeployFromGitHub}
          canDeployFromZip={canDeployFromZip}
          zipUploading={zipUploading}
          onZipInputChange={onZipInputChange}
          hasSavedHtml={hasSavedHtml}
          isDeployingHtml={isDeployingHtml}
          onDeployFromHtml={onDeployFromHtml}
          htmlUploading={htmlUploading}
          onHtmlInputChange={onHtmlInputChange}
        />
      </div>
    </div>
  );
};
