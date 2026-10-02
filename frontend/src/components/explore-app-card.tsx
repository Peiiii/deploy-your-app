import { appLanguageLabel } from '@/features/explore/stores/language-preference';
import { useAppLanguageStore } from '@/features/explore/stores/app-language.store';
import { track } from '@/analytics/collector';
/* eslint-disable react-refresh/only-export-components */
import { getAuthorColor, getAuthorInitial, getAuthorName } from '../utils/author';
import { PERFORMANCE_CONFIG } from '../constants';
import { getScrollParent } from '../utils/scroll';
import { useProjectThumbnail } from '../hooks/use-project-thumbnail';
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
  appLanguages?: string[];
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
      appLanguages: project.appLanguage?.languages,
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
  const showLanguage = useAppLanguageStore((s) => s.languages === null || s.languages.length > 1);
  const reactionEntry = useReactionStore((s) => s.byProjectId[app.id]);
  const navigate = useNavigate();
  const [isNearViewport, setIsNearViewport] = useState(
    () => typeof IntersectionObserver === 'undefined',
  );
  const thumbnail = useProjectThumbnail(app.thumbnailUrl, imagePriority || isNearViewport);
  const thumbnailAreaRef = useRef<HTMLDivElement>(null);

  const showThumbnail = app.thumbnailUrl && !thumbnail.error;
  const shouldLoadThumbnail = imagePriority || isNearViewport;
  const authorName = getAuthorName(app.author, t);
  const languageLabel = app.appLanguages?.length
    ? app.appLanguages.map(code => code === 'zxx' ? t('languages.independent') : appLanguageLabel(code)).join(' · ')
    : t('languages.unknown');

  useEffect(() => {
    if (imagePriority || !app.thumbnailUrl || isNearViewport) return;
    const thumbnailArea = thumbnailAreaRef.current;
    if (!thumbnailArea || typeof IntersectionObserver === 'undefined') return;
    const scrollRoot = getScrollParent(thumbnailArea);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setIsNearViewport(true);
        observer.disconnect();
      },
      {
        root: scrollRoot,
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
      className="surface-card group relative flex min-w-0 flex-col overflow-hidden transition-colors hover:border-app-borderHighlight break-inside-avoid"
    >
      {/* Image Area */}
      <div
        ref={thumbnailAreaRef}
        className={`relative aspect-video overflow-hidden bg-app-surfaceHighlight`}
      >
        <div
          aria-hidden="true"
          className={`absolute inset-0 flex items-center justify-center overflow-hidden transition-opacity duration-300 ${thumbnail.loaded ? 'opacity-0' : 'opacity-100'}`}
        >
          <div className="absolute inset-0 bg-black/5" />
          <span className="text-5xl font-semibold text-app-muted/25 select-none">
            {app.name.charAt(0).toUpperCase()}
          </span>
        </div>

        {showThumbnail && shouldLoadThumbnail && (
          <img
            src={thumbnail.src}
            alt={app.name}
            width={960}
            height={540}
            loading="eager"
            decoding="async"
            fetchPriority={imagePriority ? 'high' : 'auto'}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-150  ${thumbnail.loaded ? 'opacity-100' : 'opacity-0'
              }`}
            onLoad={thumbnail.onLoad}
            onError={thumbnail.onError}
          />
        )}

        <button type="button" onClick={handleRootClick} aria-label={`${t('common.visit')} ${app.name}`} className="absolute inset-0 z-10 rounded-t-2xl focus-visible:outline-offset-[-3px]" />
        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 text-white transform scale-90  transition-transform">
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
      <div className="p-4 flex flex-col gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white line-clamp-1 leading-snug group-hover:text-brand-600 transition-colors">
            <button type="button" onClick={handleRootClick} className="block w-full truncate text-left">{app.name}</button>
          </h3>
          {app.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
              {app.description}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 mt-1">
          <button
            type="button"
            disabled={!app.authorProfileIdentifier}
            title={authorName}
            className="flex flex-1 items-center gap-2 min-w-0 group/author rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-default"
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

          {showLanguage && (
            <span
              title={languageLabel}
              aria-label={`${t('languages.supportedLanguages')}：${languageLabel}`}
              className="max-w-[35%] shrink-0 truncate rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-slate-700/50 dark:text-slate-400"
            >
              {languageLabel}
            </span>
          )}
          <button
            aria-label={t('experience.likeApp', { name: app.name })} aria-pressed={Boolean(reactionEntry?.likedByCurrentUser)}
            onClick={(e) => {
              e.stopPropagation();
              presenter.reaction.toggleLike(app.id);
            }}
            className="flex shrink-0 items-center gap-1 min-h-8 min-w-8 justify-center text-slate-500 hover:text-brand-500 transition-colors group/like"
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
