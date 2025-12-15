import React from 'react';
import { RefreshCcw, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePresenter } from '@/contexts/presenter-context';
import { useProjectSettingsStore } from '@/features/project-settings/stores/project-settings.store';
import { useDeploymentStore } from '@/features/deployment/stores/deployment.store';
import { DeploymentStatus } from '@/types';
import type { Project } from '@/types';

interface ProjectSettingsRedeploySectionProps {
  project: Project;
  canDeployFromGitHub: boolean;
}

export const ProjectSettingsRedeploySection: React.FC<
  ProjectSettingsRedeploySectionProps
> = ({ project, canDeployFromGitHub }) => {
  const { t } = useTranslation();
  const presenter = usePresenter();

  // Subscribe to store state individually
  const isRedeploying = useProjectSettingsStore((s) => s.isRedeploying);
  const zipUploading = useProjectSettingsStore((s) => s.zipUploading);
  const htmlUploading = useProjectSettingsStore((s) => s.htmlUploading);

  // Deployment status from deployment store
  const deploymentStatus = useDeploymentStore((s) => s.deploymentStatus);
  const isDeploymentInProgress =
    deploymentStatus === DeploymentStatus.BUILDING ||
    deploymentStatus === DeploymentStatus.DEPLOYING;

  // Derived state
  const hasDeployedBefore =
    Boolean(project.url) ||
    project.status === 'Live' ||
    project.status === 'Failed' ||
    project.status === 'Building';
  const canDeployFromZip = true;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
        {hasDeployedBefore ? t('project.redeploy') : t('common.deploy')}
      </h3>
      <div className="flex flex-wrap gap-3">
        {canDeployFromGitHub && (
          <button
            onClick={presenter.projectSettings.redeployFromGitHub}
            disabled={isRedeploying || isDeploymentInProgress}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-brand-500 hover:text-white hover:border-brand-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCcw className="w-3 h-3" />
            {hasDeployedBefore
              ? t('project.redeployFromGitHub')
              : t('project.deployFromGitHub')}
          </button>
        )}

        {canDeployFromZip && (
          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 hover:border-brand-500 hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer transition-colors">
            <Upload className="w-3 h-3" />
            <span>
              {zipUploading
                ? t('project.uploading')
                : t('project.uploadZipAndDeploy')}
            </span>
            <input
              type="file"
              accept=".zip"
              className="hidden"
              onChange={presenter.projectSettings.handleZipInputChange}
            />
          </label>
        )}

        <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 hover:border-brand-500 hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer transition-colors">
          <Upload className="w-3 h-3" />
          <span>
            {htmlUploading
              ? t('project.uploading')
              : t('project.uploadHtmlAndDeploy')}
          </span>
          <input
            type="file"
            accept=".html,text/html"
            className="hidden"
            onChange={presenter.projectSettings.handleHtmlInputChange}
          />
        </label>
      </div>
      {canDeployFromZip && (
        <p className="text-xs text-slate-500 dark:text-gray-500">
          {t('project.zipDeploymentNote')}
        </p>
      )}

      <p className="text-xs text-slate-500 dark:text-gray-500">
        {t('project.htmlDeploymentNote')}
      </p>
    </div>
  );
};
