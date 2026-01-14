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
  Settings,
} from 'lucide-react';
import { useAnalyticsStore } from '@/stores/analytics.store';
import { getDisplayRepoUrl, getGitHubUrl } from '@/utils/project';
import { SourceType } from '@/types';
import type { Project } from '@/types';

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
      className="bg-white dark:bg-slate-900 rounded-2xl p-5 group relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer flex flex-col h-full"
      onClick={handleCardClick}
    >
      {/* Subtle Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-transparent dark:from-slate-800/30 dark:to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

      {/* Status Indicator */}
      <div
        className={`absolute top-4 right-4 flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider z-10 ${project.status === 'Live'
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
          : project.status === 'Failed'
            ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30'
            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
          }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${project.status === 'Live'
            ? 'bg-emerald-500 animate-pulse'
            : project.status === 'Failed'
              ? 'bg-red-500'
              : 'bg-amber-500'
            }`}
        />
        {project.status}
      </div>

      {/* Header - Project Name & Repo */}
      <div className="mb-3 relative pr-16">
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/projects/${encodeURIComponent(project.id)}`);
          }}
          className="font-bold text-slate-900 dark:text-white text-base group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors truncate mb-0.5 block w-full text-left"
        >
          {project.name}
        </button>
        {githubUrl ? (
          <a
            href={githubUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-gray-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors group/repo"
          >
            {project.sourceType === SourceType.ZIP ? (
              <FolderArchive className="w-3 h-3 flex-shrink-0" />
            ) : project.sourceType === SourceType.HTML ? (
              <FileCode className="w-3 h-3 flex-shrink-0" />
            ) : (
              <GitBranch className="w-3 h-3 flex-shrink-0" />
            )}
            <span className="truncate">{displayRepoUrl}</span>
            <ExternalLink className="w-3 h-3 opacity-0 group-hover/repo:opacity-100 transition-opacity flex-shrink-0" />
          </a>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-gray-500">
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

      {/* Content - flex-1 to push footer to bottom */}
      <div className="flex-1">
        {project.description && (
          <p className="text-sm text-slate-600 dark:text-gray-400 mb-4 line-clamp-2">
            {project.description}
          </p>
        )}

        <div className="space-y-2 text-xs">
          {views7d > 0 && (
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-500 dark:text-gray-500 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                {t('dashboard.views7d')}
              </span>
              <span className="text-slate-700 dark:text-gray-300 font-semibold">
                {views7d.toLocaleString()}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between py-1 border-t border-slate-100 dark:border-white/5 pt-2">
            <span className="text-slate-500 dark:text-gray-500">
              {t('dashboard.lastDeploy')}
            </span>
            <span className="text-slate-700 dark:text-gray-300 flex items-center gap-1 font-medium">
              <Clock className="w-3 h-3" />
              {project.lastDeployed}
            </span>
          </div>
        </div>
      </div>

      {/* Footer - Always at bottom */}
      <div className="flex items-center justify-between pt-3 mt-4 border-t border-slate-100 dark:border-white/5 relative">
        <div className="flex items-center gap-1">
          {project.url ? (
            <>
              <a
                href={project.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                {t('common.visit')} <ExternalLink className="w-3 h-3" />
              </a>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCopyUrl(project.url!, project.id);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                title={
                  isCopied(project.id) ? t('common.copied') : t('common.copyUrl')
                }
              >
                {isCopied(project.id) ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </>
          ) : (
            <span className="text-slate-400 dark:text-gray-600 text-xs italic">
              {t('common.notAccessible')}
            </span>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/projects/${encodeURIComponent(project.id)}`);
          }}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
          {t('common.manage')}
        </button>
      </div>
    </div>
  );
};
