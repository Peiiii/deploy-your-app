import { track } from '@/analytics/collector';
/* eslint-disable react-refresh/only-export-components */
import { getAuthorColor, getAuthorInitial, getAuthorName } from '../utils/author';
import { PERFORMANCE_CONFIG } from '../constants';
import { Heart, Play } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { usePresenter } from '../contexts/presenter-context';
import { useReactionStore } from '../stores/reaction.store';
import {
  getProjectCategory,
  getProjectDescription,
  getProjectPublicAuthor,
  getProjectAuthorProfileIdentifier,
  getProjectThumbnailUrl,
} from '../utils/project';
import type { Project } from '../types';
import type { PublicAuthorIdentity } from '@gemigo/public-author';

export interface ExploreAppCard {
  id: string;
  name: string;
  description: string;
  author: PublicAuthorIdentity;
  authorColor?: string;
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
    const thumbnailUrl = project.url
      ? getProjectThumbnailUrl(project.url, { name: project.name, seed: project.id }) ?? undefined
      : undefined;
    const author = getProjectPublicAuthor(project);
    const authorIdentifier = getProjectAuthorProfileIdentifier(project);
    const color = getProjectColor(project.id);

    return {
      id: project.id,
      name: project.name,
      description,
      author,
      authorColor: getAuthorColor(author.identityKey),
      category,
      color,
      url: project.url,
      tags: project.tags,
      thumbnailUrl,
      authorProfileIdentifier: authorIdentifier,
    };
  });
}

interface ExploreAppCardViewProps {
  app: ExploreAppCard;
  activeTag: string | null;
  setActiveTag: React.Dispatch<React.SetStateAction<string | null>>;
  imagePriority?: boolean;
  onCardClick?: () => void;
}

export const ExploreAppCardView: React.FC<ExploreAppCardViewProps> = ({
  app,
  imagePriority = false,
  onCardClick,
}) => {
  const presenter = usePresenter();
  const { t } = useTranslation();
  const reactionEntry = useReactionStore((s) => s.byProjectId[app.id]);
  const navigate = useNavigate();
  const [thumbLoaded, setThumbLoaded] = useState(false);
  const [thumbError, setThumbError] = useState(false);
  const [isNearViewport, setIsNearViewport] = useState(
    () => typeof IntersectionObserver === 'undefined',
  );
  const thumbnailAreaRef = useRef<HTMLDivElement>(null);

  const showThumbnail = app.thumbnailUrl && !thumbError;
  const shouldLoadThumbnail = imagePriority || isNearViewport;
  const authorName = getAuthorName(app.author, t);

  useEffect(() => {
    if (imagePriority || !app.thumbnailUrl || isNearViewport) return;
    const thumbnailArea = thumbnailAreaRef.current;
    if (!thumbnailArea || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setIsNearViewport(true);
        observer.disconnect();
      },
      {
        rootMargin: PERFORMANCE_CONFIG.EXPLORE_PRELOAD_ROOT_MARGIN,
        threshold: 0,
      },
    );
    observer.observe(thumbnailArea);
    return () => observer.disconnect();
  }, [app.thumbnailUrl, imagePriority, isNearViewport]);

  const handleRootClick = () => {
    track('app_preview');
    onCardClick?.();
  };

  return (
    <div
      onClick={handleRootClick}
      className="group relative flex flex-col bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 overflow-hidden shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer break-inside-avoid mb-6"
    >
      {/* Image Area */}
      <div
        ref={thumbnailAreaRef}
        className={`relative aspect-video overflow-hidden bg-gradient-to-br ${app.color}`}
      >
        <div
          aria-hidden="true"
          className={`absolute inset-0 flex items-center justify-center overflow-hidden transition-opacity duration-300 ${thumbLoaded ? 'opacity-0' : 'opacity-100'}`}
        >
          <div className="absolute inset-0 bg-black/5" />
          <span className="text-8xl font-black text-white mix-blend-overlay opacity-50 select-none transform -rotate-12 scale-150">
            {app.name.charAt(0).toUpperCase()}
          </span>
        </div>

        {showThumbnail && shouldLoadThumbnail && (
          <img
            src={app.thumbnailUrl}
            alt={app.name}
            width={960}
            height={540}
            loading="eager"
            decoding="async"
            fetchPriority={imagePriority ? 'high' : 'auto'}
            className={`absolute inset-0 w-full h-full object-cover transition-[opacity,transform] duration-500 group-hover:scale-105 ${thumbLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            onLoad={() => setThumbLoaded(true)}
            onError={() => setThumbError(true)}
          />
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
          {app.description && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
              {app.description}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between mt-1">
          <button
            type="button"
            disabled={!app.authorProfileIdentifier}
            title={authorName}
            className="flex items-center gap-2 min-w-0 group/author rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-default"
            onClick={(e) => {
              e.stopPropagation();
              if (app.authorProfileIdentifier) {
                track('author_open');
                navigate(`/u/${encodeURIComponent(app.authorProfileIdentifier)}`);

              }
            }}
          >
            <div className={`shrink-0 w-6 h-6 rounded-full bg-gradient-to-tr ${app.authorColor || getAuthorColor(app.author.identityKey)} flex items-center justify-center text-[10px] text-white font-bold shadow-sm ring-2 ring-white dark:ring-slate-800 transition-transform group-hover/author:scale-110`}>
              {getAuthorInitial(authorName, app.author.anonymousCode)}
            </div>
            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 truncate group-hover/author:text-brand-600 dark:group-hover/author:text-brand-400 transition-colors">
              {authorName}
            </span>
          </button>

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
