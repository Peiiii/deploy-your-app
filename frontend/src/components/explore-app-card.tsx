/* eslint-disable react-refresh/only-export-components */
import { Heart, Play } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
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
  category: string;
  color: string;
  url?: string;
  tags?: string[];
  thumbnailUrl?: string;
  // Identifier used for linking to the author's public profile (/u/:identifier).
  // This will be the user's handle when set, otherwise their internal user id.
  authorProfileIdentifier?: string;
}


const PLACEHOLDER_COLORS = [
  'from-blue-400 to-indigo-500',
  'from-emerald-400 to-cyan-500',
  'from-orange-400 to-pink-500',
  'from-purple-400 to-indigo-500',
  'from-red-400 to-rose-500',
  'from-cyan-400 to-blue-500',
];

function getProjectColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PLACEHOLDER_COLORS.length;
  return PLACEHOLDER_COLORS[index];
}

export function mapProjectsToApps(projects: Project[]): ExploreAppCard[] {
  return projects.map((project) => {
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
    const color = getProjectColor(project.id);

    return {
      id: project.id,
      name: project.name,
      description,
      // Prefer platform username (handle) when available, otherwise fall back
      // to the GitHub owner / default label.
      author: authorLabel,
      category,
      color,
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
  onCardClick,
}) => {
  const { t } = useTranslation();
  const presenter = usePresenter();
  const reactionEntry = useReactionStore((s) => s.byProjectId[app.id]);
  const navigate = useNavigate();
  const [thumbLoaded, setThumbLoaded] = useState(false);
  const [thumbError, setThumbError] = useState(false);

  const showThumbnail = app.thumbnailUrl && !thumbError;

  const handleRootClick = () => {
    onCardClick?.();
  };

  return (
    <div
      className="group relative flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-[0_0_10px_rgba(0,0,0,0.04)] dark:shadow-[0_0_10px_rgba(0,0,0,0.2)] border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-[0_0_30px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_0_30px_rgba(0,0,0,0.5)] hover:-translate-y-1 hover:z-10 transition-all h-full"
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



        {/* Category Badge - Top Right */}
        {app.category !== 'Other' && (
          <div className="absolute top-4 right-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold shadow-sm text-brand-600 uppercase tracking-wider border border-slate-200/50 dark:border-slate-700/50">
            {app.category}
          </div>
        )}
      </div>

      <div className="p-5 flex flex-col flex-1">


        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-brand-600 transition-colors">
          {app.name}
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 line-clamp-2 flex-1">
          {app.description}
        </p>

        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700 mt-auto">
          <div
            className="group/author flex items-center gap-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 px-2 py-1.5 -ml-2 rounded-full transition-all duration-200"
            onClick={(e) => {
              e.stopPropagation();
              if (app.authorProfileIdentifier) {
                navigate(`/u/${app.authorProfileIdentifier}`);
              } else {
                // Fallback to name match if identifier missing
                navigate(`/u/${app.author}`);
              }
            }}
          >
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-[10px] text-slate-600 font-bold">
              {app.author.charAt(0)}
            </div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200 group-hover/author:text-slate-900 dark:group-hover/author:text-white transition-colors">
              {app.author}
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRootClick();
            }}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-brand-600 hover:text-white dark:hover:bg-brand-600 text-slate-900 dark:text-white text-sm font-medium rounded-full transition-colors flex items-center gap-2"
          >
            {t('common.open')} <Play className="w-3 h-3 fill-current" />
          </button>
        </div>
      </div>
    </div>
  );
};
