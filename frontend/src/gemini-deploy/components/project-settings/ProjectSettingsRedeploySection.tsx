import React from 'react';
import { RefreshCcw, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ProjectSettingsRedeploySectionProps {
  canRedeployFromGitHub: boolean;
  isRedeploying: boolean;
  isDeploymentInProgress: boolean;
  onRedeployFromGitHub: () => void;
  zipUploading: boolean;
  onZipInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ProjectSettingsRedeploySection: React.FC<
  ProjectSettingsRedeploySectionProps
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
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
        {t('project.redeploy')}
      </h3>
      <div className="flex flex-wrap gap-3">
        <button
          onClick={onRedeployFromGitHub}
          disabled={
            !canRedeployFromGitHub ||
            isRedeploying ||
            isDeploymentInProgress
          }
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-brand-500 hover:text-white hover:border-brand-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCcw className="w-3 h-3" />
          {t('project.redeployFromGitHub')}
        </button>

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
            onChange={onZipInputChange}
          />
        </label>
      </div>
      <p className="text-xs text-slate-500 dark:text-gray-500">
        {t('project.zipDeploymentNote')}
      </p>
    </div>
  );
};

