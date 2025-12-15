/* eslint-disable react-refresh/only-export-components */
import { Heart, Play, Star, Zap } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePresenter } from '../contexts/PresenterContext';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { useReactionStore } from '../stores/reactionStore';
import {
  buildProjectAuthor,
  getProjectCategory,
  getProjectDescription,
  getProjectThumbnailUrl,
} from '../utils/project';
import type { Project } from '../types';
import { AuthorBadge } from './AuthorBadge';

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
  // Identifier used for linking to the author's public profile (/u/:identifier).
  // This will be the user's handle when set, otherwise their internal user id.
  authorProfileIdentifier?: string;
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
    const thumbnailUrl = project.url ? getProjectThumbnailUrl(project.url) ?? undefined : undefined;
    const githubAuthor = buildProjectAuthor(project);
    const handle =
      typeof project.ownerHandle === 'string' &&
      project.ownerHandle.trim().length > 0
        ? project.ownerHandle.trim()
        : null;
    const authorLabel = handle ?? githubAuthor;
    const authorIdentifier = handle ?? project.ownerId;

    return {
      id: project.id,
      name: project.name,
      description,
      // Prefer platform username (handle) when available, otherwise fall back
      // to the GitHub owner / default label.
      author: authorLabel,
      cost: meta.cost,
      category,
      color: meta.color,
      url: project.url,
      tags: project.tags,
      thumbnailUrl,
      // Fall back to ownerId so that /u/:ownerId links still work when
      // handle is missing.
      authorProfileIdentifier: authorIdentifier,
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
      className="group relative flex flex-col bg-white/90 dark:bg-slate-800/60 backdrop-blur-sm rounded-3xl border border-slate-200/60 dark:border-slate-700/50 overflow-hidden hover:shadow-2xl hover:shadow-brand-500/20 dark:hover:shadow-black/60 transition-all duration-500 hover:-translate-y-2 hover:scale-[1.02] h-full"
    >
      {/* Image Section */}
      <div
        className="relative aspect-video overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-950 border-b border-slate-100/50 dark:border-slate-700/30 group-hover:border-transparent transition-all duration-500 cursor-pointer"
        onClick={handleRootClick}
      >
        {showThumbnail ? (
          <>
            {!thumbLoaded && (
              <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800" />
            )}
            <img
              src={app.thumbnailUrl}
              alt={app.name}
              loading="lazy"
              onLoad={() => setThumbLoaded(true)}
              onError={() => setThumbError(true)}
              className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 group-hover:scale-110 ${thumbLoaded ? 'opacity-100' : 'opacity-0'
                }`}
            />
          </>
        ) : (
          <div
            className={`absolute inset-0 bg-gradient-to-br ${app.color} opacity-30 group-hover:opacity-40 transition-opacity duration-500`}
          />
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        {/* Hover CTA */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-500 transform group-hover:scale-100 scale-95">
          <div className="px-4 py-2 rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-slate-900 dark:text-white text-xs font-bold flex items-center gap-2 shadow-2xl border border-white/20 dark:border-slate-700/50">
            <Play className="w-4 h-4 fill-current" />
            <span>{t('common.open')}</span>
          </div>
        </div>

        {/* Cost Badge - Floating */}
        <div className="absolute top-4 right-4 z-10 transform group-hover:scale-110 transition-transform duration-300">
          <div className="px-3 py-1.5 rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-slate-900 dark:text-white text-xs font-bold border border-white/30 dark:border-slate-700/50 shadow-xl flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-brand-500 fill-brand-500" />
            <span>{app.cost}</span>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="flex flex-col flex-1 p-6">
        <div className="flex items-start justify-between mb-4 gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* App Icon */}
            <div
              className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center text-white shadow-lg bg-gradient-to-br ${app.color} group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 ring-2 ring-white/20 dark:ring-slate-700/30`}
            >
              <Zap className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg leading-tight truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors duration-300 mb-1">
                {app.name}
              </h3>
              <AuthorBadge
                name={app.author}
                identifier={app.authorProfileIdentifier}
              />
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-slate-600 dark:text-slate-300/90 line-clamp-2 mb-5 flex-1 leading-relaxed">
          {app.description}
        </p>

        {/* Tags (First 2 only to save space) */}
        {app.tags && app.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            {app.tags.slice(0, 2).map((tag) => (
              <button
                key={tag}
                onClick={(e) => handleTagClick(e, tag)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-300 border ${tag === activeTag
                    ? 'bg-gradient-to-r from-brand-50 to-brand-100 text-brand-700 border-brand-300 dark:from-brand-900/40 dark:to-brand-800/40 dark:text-brand-300 dark:border-brand-700 shadow-md scale-105'
                    : 'bg-slate-50/80 text-slate-600 border-slate-200 hover:bg-slate-100 hover:scale-105 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700 dark:hover:bg-slate-800'
                  }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-5 border-t border-slate-100/80 dark:border-slate-700/50 mt-auto">
          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 font-medium">
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
              className="inline-flex items-center gap-1.5 text-xs rounded-xl px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-300 hover:scale-105"
            >
              <Star
                className={`w-4 h-4 transition-all duration-300 ${reactionEntry?.favoritedByCurrentUser
                    ? 'text-amber-500 fill-amber-500 scale-110'
                    : 'text-slate-400 hover:text-amber-400'
                  }`}
              />
              <span className="text-slate-700 dark:text-slate-300 font-semibold">
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
              className="inline-flex items-center gap-1.5 text-xs rounded-xl px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-300 hover:scale-105"
            >
              <Heart
                className={`w-4 h-4 transition-all duration-300 ${reactionEntry?.likedByCurrentUser
                    ? 'fill-pink-500 text-pink-500 scale-110'
                    : 'text-slate-400 hover:text-pink-400'
                  }`}
              />
              <span className="text-slate-700 dark:text-slate-300 font-semibold">
                {(reactionEntry?.likesCount ?? 0).toLocaleString()}
              </span>
            </button>
          </div>

          <button
            onClick={handleLaunchApp}
            className="text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 text-sm font-bold flex items-center gap-2 group/btn px-4 py-2 rounded-xl hover:bg-gradient-to-r hover:from-brand-50 hover:to-brand-100 dark:hover:from-brand-900/30 dark:hover:to-brand-800/30 transition-all duration-300 hover:scale-105 shadow-sm hover:shadow-md"
          >
            {t('common.open')}
            <Play className="w-4 h-4 fill-current transition-transform duration-300 group-hover/btn:translate-x-1" />
          </button>
        </div>
      </div>
    </div>
  );
};
