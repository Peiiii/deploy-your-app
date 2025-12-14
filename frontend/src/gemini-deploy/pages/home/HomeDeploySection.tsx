import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, FileCode, FolderArchive, Github, Sparkles } from 'lucide-react';
import { SourceType } from '../../types';

interface HomeDeploySectionProps {
  compact: boolean;
  onQuickDeploy: (sourceType: SourceType) => void;
}

export const HomeDeploySection: React.FC<HomeDeploySectionProps> = ({
  compact,
  onQuickDeploy,
}) => {
  const { t } = useTranslation();

  return (
    <section
      className={`glass-card rounded-2xl md:rounded-3xl p-5 md:p-8 lg:p-10 relative overflow-hidden group/section ${
        compact ? 'lg:p-6' : ''
      }`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 via-transparent to-purple-500/5 opacity-0 group-hover/section:opacity-100 transition-opacity duration-500" />
      <div className="relative z-10">
        <div className={`flex items-center justify-between ${compact ? 'mb-6' : 'mb-8'}`}>
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Sparkles
                className={`text-brand-500 animate-pulse ${compact ? 'w-5 h-5' : 'w-5 h-5 md:w-6 md:h-6'}`}
              />
              <h2
                className={`font-bold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-white dark:via-slate-100 dark:to-white bg-clip-text text-transparent ${
                  compact ? 'text-xl md:text-2xl' : 'text-2xl sm:text-3xl md:text-4xl'
                }`}
              >
                {t('deployment.deployYourApp')}
              </h2>
            </div>
            <p className={`text-slate-600 dark:text-slate-400 ${compact ? 'text-xs md:text-sm' : 'text-sm md:text-base'}`}>
              {t('deployment.chooseDeploymentMethod')}
            </p>
          </div>
        </div>

        <div
          className={`grid gap-4 md:gap-5 ${
            compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
          }`}
        >
          <button
            onClick={() => onQuickDeploy(SourceType.GITHUB)}
            className={`group relative border-2 border-slate-200/60 dark:border-slate-800/60 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm hover:border-purple-500/60 dark:hover:border-purple-500/60 hover:shadow-2xl hover:shadow-purple-500/20 hover:-translate-y-1 transition-all duration-300 text-left overflow-hidden ${
              compact ? 'p-4 rounded-xl' : 'p-5 md:p-7 rounded-xl md:rounded-2xl'
            }`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-purple-500/0 group-hover:from-purple-500/5 group-hover:to-purple-600/5 transition-all duration-300" />
            <div className="relative z-10">
              <div className={`flex items-start justify-between ${compact ? 'mb-3' : 'mb-5'}`}>
                <div
                  className={`rounded-xl bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/50 dark:to-purple-800/50 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-purple-500/20 ${
                    compact ? 'p-3' : 'p-4'
                  }`}
                >
                  <Github
                    className={`text-purple-600 dark:text-purple-400 ${compact ? 'w-5 h-5' : 'w-7 h-7'}`}
                  />
                </div>
                <ArrowRight
                  className={`text-slate-400 group-hover:text-purple-500 group-hover:translate-x-2 transition-all duration-300 ${
                    compact ? 'w-4 h-4' : 'w-5 h-5'
                  }`}
                />
              </div>
              <h3
                className={`font-bold text-slate-900 dark:text-white mb-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors ${
                  compact ? 'text-base' : 'text-lg'
                }`}
              >
                {t('deployment.githubRepository')}
              </h3>
              <p className={`text-slate-600 dark:text-slate-400 leading-relaxed ${compact ? 'text-xs' : 'text-sm'}`}>
                {t('deployment.connectGitHubRepo')}
              </p>
            </div>
          </button>

          <button
            onClick={() => onQuickDeploy(SourceType.ZIP)}
            className={`group relative border-2 border-slate-200/60 dark:border-slate-800/60 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm hover:border-blue-500/60 dark:hover:border-blue-500/60 hover:shadow-2xl hover:shadow-blue-500/20 hover:-translate-y-1 transition-all duration-300 text-left overflow-hidden ${
              compact ? 'p-4 rounded-xl' : 'p-5 md:p-7 rounded-xl md:rounded-2xl'
            }`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-blue-500/0 group-hover:from-blue-500/5 group-hover:to-blue-600/5 transition-all duration-300" />
            <div className="relative z-10">
              <div className={`flex items-start justify-between ${compact ? 'mb-3' : 'mb-5'}`}>
                <div
                  className={`rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/50 dark:to-blue-800/50 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-blue-500/20 ${
                    compact ? 'p-3' : 'p-4'
                  }`}
                >
                  <FolderArchive
                    className={`text-blue-600 dark:text-blue-400 ${compact ? 'w-5 h-5' : 'w-7 h-7'}`}
                  />
                </div>
                <ArrowRight
                  className={`text-slate-400 group-hover:text-blue-500 group-hover:translate-x-2 transition-all duration-300 ${
                    compact ? 'w-4 h-4' : 'w-5 h-5'
                  }`}
                />
              </div>
              <h3
                className={`font-bold text-slate-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors ${
                  compact ? 'text-base' : 'text-lg'
                }`}
              >
                {t('deployment.uploadArchive')}
              </h3>
              <p className={`text-slate-600 dark:text-slate-400 leading-relaxed ${compact ? 'text-xs' : 'text-sm'}`}>
                {t('deployment.uploadZipFile')}
              </p>
            </div>
          </button>

          <button
            onClick={() => onQuickDeploy(SourceType.HTML)}
            className={`group relative border-2 border-slate-200/60 dark:border-slate-800/60 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm hover:border-emerald-500/60 dark:hover:border-emerald-500/60 hover:shadow-2xl hover:shadow-emerald-500/20 hover:-translate-y-1 transition-all duration-300 text-left overflow-hidden ${
              compact ? 'p-4 rounded-xl' : 'p-5 md:p-7 rounded-xl md:rounded-2xl'
            }`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 to-emerald-500/0 group-hover:from-emerald-500/5 group-hover:to-emerald-600/5 transition-all duration-300" />
            <div className="relative z-10">
              <div className={`flex items-start justify-between ${compact ? 'mb-3' : 'mb-5'}`}>
                <div
                  className={`rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900/50 dark:to-emerald-800/50 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-emerald-500/20 ${
                    compact ? 'p-3' : 'p-4'
                  }`}
                >
                  <FileCode
                    className={`text-emerald-600 dark:text-emerald-400 ${compact ? 'w-5 h-5' : 'w-7 h-7'}`}
                  />
                </div>
                <ArrowRight
                  className={`text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-2 transition-all duration-300 ${
                    compact ? 'w-4 h-4' : 'w-5 h-5'
                  }`}
                />
              </div>
              <h3
                className={`font-bold text-slate-900 dark:text-white mb-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors ${
                  compact ? 'text-base' : 'text-lg'
                }`}
              >
                {t('deployment.inlineHTML')}
              </h3>
              <p className={`text-slate-600 dark:text-slate-400 leading-relaxed ${compact ? 'text-xs' : 'text-sm'}`}>
                {t('deployment.pasteHTML')}
              </p>
            </div>
          </button>
        </div>
      </div>
    </section>
  );
};

