import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  ExternalLink,
  GitBranch,
  Clock,
  FolderArchive,
  TrendingUp,
  FileCode,
  Copy,
  Check,
} from 'lucide-react';
import { useAnalyticsStore } from '../../stores/analyticsStore';
import { getDisplayRepoUrl, getGitHubUrl } from '../../utils/project';
import { SourceType } from '../../types';
import type { Project } from '../../types';

interface ProjectCardProps {
  project: Project;
  onCopyUrl: (url: string, projectId: string) => void;
  isCopied: (key: string) => boolean;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onCopyUrl,
  isCopied,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const analyticsByProject = useAnalyticsStore((s) => s.byProjectId);
  const analytics = analyticsByProject[project.id];
  const views7d = analytics?.stats?.views7d ?? 0;

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('a') || target.closest('button')) {
      return;
    }
    navigate(`/projects/${encodeURIComponent(project.id)}`);
  };

  const githubUrl = getGitHubUrl(project);
  const displayRepoUrl = getDisplayRepoUrl(project.repoUrl);

  return (
    <div
      className="glass-card rounded-xl p-6 group relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border border-slate-200/50 dark:border-slate-700/50 hover:border-brand-500/30 dark:hover:border-brand-500/20 cursor-pointer"
      onClick={handleCardClick}
    >
      {/* Status Indicator */}
      <div
        className={`absolute top-4 right-4 flex items-center gap-2 px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider z-10 ${
          project.status === 'Live'
            ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
            : project.status === 'Failed'
              ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
              : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20'
        }`}
      >
        <div
          className={`w-1.5 h-1.5 rounded-full ${
            project.status === 'Live'
              ? 'bg-green-500 dark:bg-green-400 animate-pulse'
              : project.status === 'Failed'
                ? 'bg-red-500 dark:bg-red-400'
                : 'bg-yellow-500 dark:bg-yellow-400'
          }`}
        ></div>
        {project.status}
      </div>

      <div className="flex items-start gap-4 mb-5">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center border shadow-inner flex-shrink-0 transition-transform group-hover:scale-110 ${
            project.framework === 'React'
              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
              : project.framework === 'Next.js'
                ? 'bg-black/10 text-black dark:text-white border-black/20 dark:border-white/20'
                : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-white border-slate-200 dark:border-white/10'
          }`}
        >
          <span className="font-bold text-sm tracking-tighter">
            {project.framework.slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/projects/${encodeURIComponent(project.id)}`);
            }}
            className="font-bold text-slate-900 dark:text-white text-lg group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors truncate mb-1 block w-full text-left hover:underline decoration-brand-500/50"
          >
            {project.name}
          </button>
          {githubUrl ? (
            <a
              href={githubUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 text-xs text-slate-500 dark:text-gray-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors group/repo"
            >
              {project.sourceType === SourceType.ZIP ? (
                <FolderArchive className="w-3 h-3 flex-shrink-0" />
              ) : project.sourceType === SourceType.HTML ? (
                <FileCode className="w-3 h-3 flex-shrink-0" />
              ) : (
                <GitBranch className="w-3 h-3 flex-shrink-0 group-hover/repo:text-brand-600 dark:group-hover/repo:text-brand-400" />
              )}
              <span className="truncate hover:underline decoration-brand-500/50">
                {displayRepoUrl}
              </span>
              <ExternalLink className="w-3 h-3 opacity-0 group-hover/repo:opacity-100 transition-opacity flex-shrink-0" />
            </a>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-gray-500">
              {project.sourceType === SourceType.ZIP ? (
                <FolderArchive className="w-3 h-3 flex-shrink-0" />
              ) : project.sourceType === SourceType.HTML ? (
                <FileCode className="w-3 h-3 flex-shrink-0" />
              ) : (
                <GitBranch className="w-3 h-3 flex-shrink-0" />
              )}
              <span className="truncate">{displayRepoUrl}</span>
            </div>
          )}
        </div>
      </div>

      {project.description && (
        <p className="text-sm text-slate-600 dark:text-gray-400 mb-4 line-clamp-2">
          {project.description}
        </p>
      )}

      <div className="space-y-2.5 mb-5">
        {views7d > 0 && (
          <div className="flex items-center justify-between text-sm py-1.5">
            <span className="text-slate-500 dark:text-gray-500 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              {t('dashboard.views7d')}
            </span>
            <span className="text-slate-700 dark:text-gray-300 font-medium">
              {views7d.toLocaleString()}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between text-sm py-1.5 border-t border-slate-100 dark:border-white/5 pt-2.5">
          <span className="text-slate-500 dark:text-gray-500">
            {t('dashboard.lastDeploy')}
          </span>
          <span className="text-slate-700 dark:text-gray-300 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span className="text-xs">{project.lastDeployed}</span>
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-white/5">
        <div className="flex items-center gap-2">
          {project.url ? (
            <>
              <a
                href={project.url}
                target="_blank"
                rel="noreferrer"
                className="text-green-600 dark:text-green-400 hover:text-green-500 dark:hover:text-green-300 text-sm font-medium flex items-center gap-1 transition-colors hover:underline decoration-green-500/50"
                onClick={(e) => e.stopPropagation()}
              >
                {t('common.visit')} <ExternalLink className="w-3 h-3" />
              </a>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCopyUrl(project.url!, project.id);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                title={
                  isCopied(project.id) ? t('common.copied') : t('common.copyUrl')
                }
              >
                {isCopied(project.id) ? (
                  <Check className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </>
          ) : (
            <span className="text-slate-400 dark:text-gray-600 text-sm italic">
              {t('common.notAccessible')}
            </span>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/projects/${encodeURIComponent(project.id)}`);
          }}
          className="text-xs text-slate-500 dark:text-gray-400 hover:text-brand-500 dark:hover:text-brand-400 underline-offset-2 hover:underline transition-colors px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          {t('common.manage')}
        </button>
      </div>
    </div>
  );
};
