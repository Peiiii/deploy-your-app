/* eslint-disable react-refresh/only-export-components */
import { Heart, Play } from 'lucide-react';
import React, { useState } from 'react';
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
      onClick={handleRootClick}
      className="group relative flex flex-col bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 overflow-hidden shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer break-inside-avoid mb-6"
    >
      {/* Image Area */}
      <div
        className={`relative aspect-video overflow-hidden ${!showThumbnail ? `bg-gradient-to-br ${app.color}` : ''}`}
      >
        {showThumbnail ? (
          <img
            src={app.thumbnailUrl}
            alt={app.name}
            className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${thumbLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            onLoad={() => setThumbLoaded(true)}
            onError={() => setThumbError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-black/5" />
            <span className="text-8xl font-black text-white mix-blend-overlay opacity-50 select-none transform -rotate-12 scale-150">
              {app.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 text-white transform scale-90 group-hover:scale-100 transition-transform">
            <Play className="w-6 h-6 fill-current" />
          </div>
        </div>

        {/* Category Badge - Optional, top right overlay */}
        {app.category !== 'Other' && (
          <div className="absolute top-2 right-2 bg-black/20 backdrop-blur-md px-2 py-0.5 rounded-full text-[10px] font-medium text-white/90 uppercase tracking-wider border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
            {app.category}
          </div>
        )}
      </div>

      {/* Info Area */}
      <div className="p-3 flex flex-col gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-1 leading-snug group-hover:text-brand-600 transition-colors">
            {app.name}
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
            {app.description}
          </p>
        </div>

        <div className="flex items-center justify-between mt-1">
          <div
            className="flex items-center gap-2 min-w-0 group/author"
            onClick={(e) => {
              e.stopPropagation();
              if (app.authorProfileIdentifier) {
                navigate(`/u/${app.authorProfileIdentifier}`);
              } else {
                navigate(`/u/${app.author}`);
              }
            }}
          >
            <div className={`shrink-0 w-6 h-6 rounded-full bg-gradient-to-tr ${app.color} flex items-center justify-center text-[10px] text-white font-bold shadow-sm ring-2 ring-white dark:ring-slate-800 transition-transform group-hover/author:scale-110`}>
              {app.author.charAt(0).toUpperCase()}
            </div>
            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 truncate group-hover/author:text-brand-600 dark:group-hover/author:text-brand-400 transition-colors">
              {app.author}
            </span>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              presenter.reaction.toggleLike(app.id);
            }}
            className="flex items-center gap-1 text-slate-400 hover:text-brand-500 transition-colors group/like"
          >
            <Heart
              className={`w-3.5 h-3.5 transition-transform group-hover/like:scale-110 ${reactionEntry?.likedByCurrentUser ? 'fill-brand-500 text-brand-500' : ''}`}
            />
            {reactionEntry?.likesCount > 0 && (
              <span className="text-[11px] font-medium">{reactionEntry.likesCount}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
