/* eslint-disable react-refresh/only-export-components */
import { Heart, Play, Star } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePresenter } from '../contexts/presenter-context';
import { useReactionStore } from '../stores/reaction.store';
import {
  buildProjectAuthor,
  getProjectCategory,
  getProjectDescription,
  getProjectThumbnailUrl,
} from '../utils/project';
import type { Project } from '../types';

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
  rating?: number;
  installs?: string;
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
      rating: meta.rating,
      installs: meta.installs,
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
  onCardClick,
}) => {
  const { t } = useTranslation();
  const presenter = usePresenter();
  const reactionEntry = useReactionStore((s) => s.byProjectId[app.id]);
  const [thumbLoaded, setThumbLoaded] = useState(false);
  const [thumbError, setThumbError] = useState(false);

  const showThumbnail = app.thumbnailUrl && !thumbError;

  const handleRootClick = () => {
    onCardClick?.();
  };

  return (
    <div
      className="group relative flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-xl transition-shadow h-full"
    >
      <div
        className={`h-48 overflow-hidden relative cursor-pointer ${!showThumbnail ? `bg-gradient-to-br ${app.color}` : ''}`}
        onClick={handleRootClick}
      >
        {showThumbnail ? (
          <img
            src={app.thumbnailUrl}
            alt={app.name}
            className={`w-full h-full object-cover transition-opacity duration-500 ${thumbLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            onLoad={() => setThumbLoaded(true)}
            onError={() => setThumbError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center relative overflow-hidden">
            {/* Decorative Pattern - optional, can just use the gradient + text */}
            <div className="absolute inset-0 bg-black/10" />

            {/* Large Initials */}
            <span className="text-8xl font-black text-white mix-blend-overlay opacity-50 select-none transform -rotate-12 scale-150">
              {app.name.charAt(0).toUpperCase()}
            </span>

            {/* Category Icon/Tag replacement effectively handled by the big letter for visual noise */}
          </div>
        )}

        {/* Like Button - Top Left */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            presenter.reaction.toggleLike(app.id);
          }}
          className={`absolute top-4 left-4 p-2 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur shadow-sm transition-colors ${reactionEntry?.likedByCurrentUser
            ? 'text-pink-500'
            : 'text-slate-400 hover:text-pink-500'
            }`}
        >
          <Heart
            className={`w-4 h-4 ${reactionEntry?.likedByCurrentUser ? 'fill-current' : ''
              }`}
          />
        </button>

        {/* Price - Top Right */}
        {app.cost > 0 && (
          <div className="absolute top-4 right-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold shadow-sm text-slate-900 dark:text-white">
            ${app.cost}
          </div>
        )}
      </div>

      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-brand-600 uppercase tracking-wider">
            {app.category}
          </span>
          {(app.rating || app.installs) && (
            <div className="flex items-center gap-1 text-slate-400 text-xs">
              {app.rating && (
                <>
                  <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                  <span>{app.rating}</span>
                </>
              )}
              {app.installs && <span>({app.installs})</span>}
            </div>
          )}
        </div>

        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-brand-600 transition-colors">
          {app.name}
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 line-clamp-2 flex-1">
          {app.description}
        </p>

        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700 mt-auto">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-[10px] text-slate-600 font-bold">
              {app.author.charAt(0)}
            </div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {app.author}
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRootClick();
            }}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-brand-600 hover:text-white dark:hover:bg-brand-600 text-slate-900 dark:text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {t('common.open')} <Play className="w-3 h-3 fill-current" />
          </button>
        </div>
      </div>
    </div>
  );
};
