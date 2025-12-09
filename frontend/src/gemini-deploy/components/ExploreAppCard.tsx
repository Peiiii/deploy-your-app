/* eslint-disable react-refresh/only-export-components */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Heart, Play, Star, User, Zap } from 'lucide-react';
import { URLS } from '../constants';
import { usePresenter } from '../contexts/PresenterContext';
import { useReactionStore } from '../stores/reactionStore';
import { useAuthStore } from '../stores/authStore';
import type { Project } from '../types';
import { SourceType } from '../types';

const THUMBNAIL_PATH = '/__thumbnail.png';
const DEFAULT_AUTHOR = 'Indie Hacker';
const DEFAULT_CATEGORY = 'Other';

export interface ExploreAppCard {
  id: string;
  name: string;
  description: string;
  author: string;
  cost: number;
  category: string;
  color: string;
  url?: string;
  tags?: string[];
  thumbnailUrl?: string;
}

function buildDescription(project: Project): string {
  const frameworkPart =
    project.framework === 'Unknown' ? 'AI app' : `${project.framework} app`;
  const sourcePart =
    project.sourceType === SourceType.ZIP
      ? 'uploaded as a ZIP archive'
      : project.sourceType === SourceType.GITHUB
        ? 'connected from GitHub'
        : project.sourceType === SourceType.HTML
          ? 'built from inline HTML'
          : 'deployed with GemiGo';
  return `Deployed ${frameworkPart} ${sourcePart}.`;
}

function buildAuthor(project: Project): string {
  if (
    project.sourceType === SourceType.GITHUB &&
    project.repoUrl.startsWith(URLS.GITHUB_BASE)
  ) {
    const rest = project.repoUrl.replace(URLS.GITHUB_BASE, '');
    const owner = rest.split('/')[0];
    if (owner) return owner;
  }
  return DEFAULT_AUTHOR;
}

function buildThumbnailUrl(projectUrl: string): string | undefined {
  try {
    const url = new URL(projectUrl, window.location.origin);
    url.pathname = THUMBNAIL_PATH;
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return undefined;
  }
}

function getProjectCategory(project: Project): string {
  return project.category && project.category.trim().length > 0
    ? project.category
    : DEFAULT_CATEGORY;
}

function getProjectDescription(project: Project): string {
  return project.description && project.description.trim().length > 0
    ? project.description
    : buildDescription(project);
}

export function mapProjectsToApps(
  projects: Project[],
  appMeta: readonly {
    cost: number;
    category: string;
    rating: number;
    installs: string;
    color: string;
  }[],
): ExploreAppCard[] {
  return projects.map((project, index) => {
    const meta = appMeta[index % appMeta.length];
    const category = getProjectCategory(project);
    const description = getProjectDescription(project);
    const thumbnailUrl = project.url ? buildThumbnailUrl(project.url) : undefined;

    return {
      id: project.id,
      name: project.name,
      description,
      author: buildAuthor(project),
      cost: meta.cost,
      category,
      color: meta.color,
      url: project.url,
      tags: project.tags,
      thumbnailUrl,
    };
  });
}

interface ExploreAppCardViewProps {
  app: ExploreAppCard;
  activeTag: string | null;
  setActiveTag: React.Dispatch<React.SetStateAction<string | null>>;
  onCardClick?: () => void;
}

export const ExploreAppCardView: React.FC<ExploreAppCardViewProps> = ({
  app,
  activeTag,
  setActiveTag,
  onCardClick,
}) => {
  const { t } = useTranslation();
  const presenter = usePresenter();
  const user = useAuthStore((s) => s.user);
  const reactionEntry = useReactionStore((s) => s.byProjectId[app.id]);
  const [thumbLoaded, setThumbLoaded] = useState(false);
  const [thumbError, setThumbError] = useState(false);

  const showThumbnail = app.thumbnailUrl && !thumbError;

  const handleLaunchApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (app.url) {
      window.open(app.url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleTagClick = (e: React.MouseEvent, tag: string) => {
    e.stopPropagation();
    setActiveTag((current) => (current === tag ? null : tag));
  };

  const handleRootClick = () => {
    onCardClick?.();
  };

  return (
    <div
      className="group relative flex flex-col bg-white dark:bg-slate-800/40 backdrop-blur-sm rounded-2xl border border-slate-200 dark:border-slate-700/60 overflow-hidden hover:shadow-2xl hover:shadow-brand-500/10 dark:hover:shadow-black/50 transition-all duration-300 hover:-translate-y-1 h-full"
      onClick={handleRootClick}
    >
      {/* Image Section */}
      <div className="relative aspect-video overflow-hidden bg-slate-100 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700/30 group-hover:border-transparent transition-colors">
        {showThumbnail ? (
          <>
            {!thumbLoaded && (
              <div className="absolute inset-0 animate-pulse bg-slate-200 dark:bg-slate-800" />
            )}
            <img
              src={app.thumbnailUrl}
              alt={app.name}
              loading="lazy"
              onLoad={() => setThumbLoaded(true)}
              onError={() => setThumbError(true)}
              className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${
                thumbLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </>
        ) : (
          // Fallback pattern when no thumbnail
          <div
            className={`absolute inset-0 bg-gradient-to-br ${app.color} opacity-20`}
          />
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 dark:group-hover:bg-black/20 transition-colors duration-300" />

        {/* Cost Badge - Floating */}
        <div className="absolute top-3 right-3 z-10">
          <div className="px-2.5 py-1 rounded-full bg-white/90 dark:bg-slate-900/80 backdrop-blur-md text-slate-900 dark:text-white text-[10px] font-bold border border-white/20 shadow-sm flex items-center gap-1">
            <span>⚡</span> {app.cost}
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="flex flex-col flex-1 p-5">
        <div className="flex items-start justify-between mb-3 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* App Icon */}
            <div
              className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-white shadow-sm bg-gradient-to-br ${app.color}`}
            >
              <Zap className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base leading-tight truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                {app.name}
              </h3>
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                <User className="w-3 h-3" /> {app.author}
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-slate-600 dark:text-slate-300/90 line-clamp-2 mb-4 flex-1 leading-relaxed">
          {app.description}
        </p>

        {/* Tags (First 2 only to save space) */}
        {app.tags && app.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {app.tags.slice(0, 2).map((tag) => (
              <button
                key={tag}
                onClick={(e) => handleTagClick(e, tag)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors border ${
                  tag === activeTag
                    ? 'bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-900/30 dark:text-brand-300 dark:border-brand-700'
                    : 'bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700 dark:hover:bg-slate-800'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700/50 mt-auto">
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-medium">
            {/* Favorites */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!user) {
                  presenter.auth.openAuthModal('login');
                  return;
                }
                presenter.reaction.toggleFavorite(app.id);
              }}
              className="inline-flex items-center gap-1 text-[11px] rounded-full px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Star
                className={`w-3.5 h-3.5 ${
                  reactionEntry?.favoritedByCurrentUser
                    ? 'text-amber-400 fill-amber-400'
                    : 'text-slate-400'
                }`}
              />
              <span className="text-slate-700 dark:text-slate-300">
                {(reactionEntry?.favoritesCount ?? 0).toLocaleString()}
              </span>
            </button>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            {/* Likes */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!user) {
                  presenter.auth.openAuthModal('login');
                  return;
                }
                presenter.reaction.toggleLike(app.id);
              }}
              className="inline-flex items-center gap-1 text-[11px] rounded-full px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Heart
                className={`w-3 h-3 ${
                  reactionEntry?.likedByCurrentUser
                    ? 'fill-pink-500 text-pink-500'
                    : 'text-slate-400'
                }`}
              />
              <span className="text-slate-700 dark:text-slate-300">
                {(reactionEntry?.likesCount ?? 0).toLocaleString()}
              </span>
            </button>
          </div>

          <button
            onClick={handleLaunchApp}
            className="text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 text-sm font-bold flex items-center gap-1 group/btn px-3 py-1.5 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-all"
          >
            {t('common.open')}{' '}
            <Play className="w-3 h-3 fill-current transition-transform group-hover/btn:translate-x-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
