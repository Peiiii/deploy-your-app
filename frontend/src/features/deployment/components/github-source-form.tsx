import React from 'react';
import { useTranslation } from 'react-i18next';
import { Github } from 'lucide-react';
import { normalizeGitHubRepoUrl } from '@/utils/project';

interface GithubSourceFormProps {
  repoUrl: string;
  onRepoUrlChange: (value: string) => void;
}

export const GithubSourceForm: React.FC<GithubSourceFormProps> = ({
  repoUrl,
  onRepoUrlChange,
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <label htmlFor="publication-repo" className="block text-sm font-medium text-slate-900 dark:text-white">
        {t('project.repository')} URL
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Github className="h-5 w-5 text-slate-400 dark:text-slate-500" />
        </div>
        <input
          id="publication-repo"
          type="text"
          value={repoUrl}
          onChange={(e) => onRepoUrlChange(e.target.value)}
          placeholder="github.com/username/repository"
          className="block w-full pl-12 pr-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent transition-all"
        />
      </div>
      {repoUrl.trim() && !normalizeGitHubRepoUrl(repoUrl) && <p role="alert" className="text-xs text-red-500">{t('deployment.invalidGithubRepo')}</p>}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {t('deployment.connectRepoDescription')}
      </p>
    </div>
  );
};

