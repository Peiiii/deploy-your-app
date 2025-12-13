import React from 'react';
import { FileText, RefreshCcw, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ProjectSettingsRedeploySectionProps {
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

export const ProjectSettingsRedeploySection: React.FC<
  ProjectSettingsRedeploySectionProps
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
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
        {hasDeployedBefore ? t('project.redeploy') : t('common.deploy')}
      </h3>
      <div className="flex flex-wrap gap-3">
        {canDeployFromGitHub && (
          <button
            onClick={onRedeployFromGitHub}
            disabled={isRedeploying || isDeploymentInProgress}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-brand-500 hover:text-white hover:border-brand-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCcw className="w-3 h-3" />
            {hasDeployedBefore
              ? t('project.redeployFromGitHub')
              : t('project.deployFromGitHub')}
          </button>
        )}

        <button
          onClick={onDeployFromHtml}
          disabled={!hasSavedHtml || isDeployingHtml || isDeploymentInProgress}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-brand-500 hover:text-white hover:border-brand-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <FileText className="w-3 h-3" />
          {t('project.deployFromHtml')}
        </button>

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
              onChange={onZipInputChange}
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
            onChange={onHtmlInputChange}
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
