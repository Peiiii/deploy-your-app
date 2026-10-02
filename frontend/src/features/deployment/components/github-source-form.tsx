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
    <div>
      <label htmlFor="publication-repo" className="sr-only">
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
          className="block w-full rounded-xl border border-slate-200 py-3 pl-12 pr-4 text-sm dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
        />
      </div>
      {repoUrl.trim() && !normalizeGitHubRepoUrl(repoUrl) && <p role="alert" className="mt-3 text-xs text-red-500">{t('deployment.invalidGithubRepo')}</p>}
    </div>
  );
};
