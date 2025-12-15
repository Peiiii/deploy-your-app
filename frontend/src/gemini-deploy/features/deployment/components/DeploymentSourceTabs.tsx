import React from 'react';
import { useTranslation } from 'react-i18next';
import { Github, FolderArchive, FileCode, Check } from 'lucide-react';
import { SourceType } from '../../types';

interface DeploymentSourceTabsProps {
  activeSource: SourceType;
  onSelect: (type: SourceType) => void;
}

export const DeploymentSourceTabs: React.FC<DeploymentSourceTabsProps> = ({
  activeSource,
  onSelect,
}) => {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <button
        type="button"
        onClick={() => onSelect(SourceType.GITHUB)}
        className={`group relative p-6 rounded-xl border-2 text-left transition-all duration-200 hover:shadow-lg ${
          activeSource === SourceType.GITHUB
            ? 'border-purple-500 dark:border-purple-400 bg-purple-50 dark:bg-purple-950/20 shadow-md'
            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-purple-300 dark:hover:border-purple-800'
        }`}
      >
        <div className="flex items-start justify-between mb-4">
          <div
            className={`p-3 rounded-lg transition-colors ${
              activeSource === SourceType.GITHUB
                ? 'bg-purple-100 dark:bg-purple-900/40'
                : 'bg-slate-100 dark:bg-slate-800 group-hover:bg-purple-50 dark:group-hover:bg-purple-950/20'
            }`}
          >
            <Github
              className={`w-6 h-6 ${
                activeSource === SourceType.GITHUB
                  ? 'text-purple-600 dark:text-purple-400'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            />
          </div>
          {activeSource === SourceType.GITHUB && (
            <div className="w-5 h-5 rounded-full bg-purple-600 dark:bg-purple-500 flex items-center justify-center">
              <Check className="w-3 h-3 text-white" />
            </div>
          )}
        </div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
          {t('deployment.githubRepository')}
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {t('deployment.connectRepoDescription')}
        </p>
      </button>

      <button
        type="button"
        onClick={() => onSelect(SourceType.ZIP)}
        className={`group relative p-6 rounded-xl border-2 text-left transition-all duration-200 hover:shadow-lg ${
          activeSource === SourceType.ZIP
            ? 'border-purple-500 dark:border-purple-400 bg-purple-50 dark:bg-purple-950/20 shadow-md'
            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-purple-300 dark:hover:border-purple-800'
        }`}
      >
        <div className="flex items-start justify-between mb-4">
          <div
            className={`p-3 rounded-lg transition-colors ${
              activeSource === SourceType.ZIP
                ? 'bg-purple-100 dark:bg-purple-900/40'
                : 'bg-slate-100 dark:bg-slate-800 group-hover:bg-purple-50 dark:group-hover:bg-purple-950/20'
            }`}
          >
            <FolderArchive
              className={`w-6 h-6 ${
                activeSource === SourceType.ZIP
                  ? 'text-purple-600 dark:text-purple-400'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            />
          </div>
          {activeSource === SourceType.ZIP && (
            <div className="w-5 h-5 rounded-full bg-purple-600 dark:bg-purple-500 flex items-center justify-center">
              <Check className="w-3 h-3 text-white" />
            </div>
          )}
        </div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
          {t('deployment.uploadArchive')}
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {t('deployment.uploadZipDescription')}
        </p>
      </button>

      <button
        type="button"
        onClick={() => onSelect(SourceType.HTML)}
        className={`group relative p-6 rounded-xl border-2 text-left transition-all duration-200 hover:shadow-lg ${
          activeSource === SourceType.HTML
            ? 'border-purple-500 dark:border-purple-400 bg-purple-50 dark:bg-purple-950/20 shadow-md'
            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-purple-300 dark:hover:border-purple-800'
        }`}
      >
        <div className="flex items-start justify-between mb-4">
          <div
            className={`p-3 rounded-lg transition-colors ${
              activeSource === SourceType.HTML
                ? 'bg-purple-100 dark:bg-purple-900/40'
                : 'bg-slate-100 dark:bg-slate-800 group-hover:bg-purple-50 dark:group-hover:bg-purple-950/20'
            }`}
          >
            <FileCode
              className={`w-6 h-6 ${
                activeSource === SourceType.HTML
                  ? 'text-purple-600 dark:text-purple-400'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            />
          </div>
          {activeSource === SourceType.HTML && (
            <div className="w-5 h-5 rounded-full bg-purple-600 dark:bg-purple-500 flex items-center justify-center">
              <Check className="w-3 h-3 text-white" />
            </div>
          )}
        </div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
          {t('deployment.inlineHTML')}
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {t('deployment.pasteHTMLDescription')}
        </p>
      </button>
    </div>
  );
};

