import React, { useId, useRef, useState } from 'react';
import { ExternalLink, Heart, MessageCircle, Star, Settings, Maximize2, Minimize2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ExploreAppCard } from '@/components/explore-app-card';
import { useFloatingDock, type UseFloatingDockOptions } from './use-floating-dock';
import { BrandLogo } from './brand-logo';
import { usePresenter } from '@/contexts/presenter-context';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { useReactionStore } from '@/stores/reaction.store';

// ============================================================================
// PREVIEW FLOATING DOCK COMPONENT
// ============================================================================
// A draggable widget that docks to edges of its parent container.
// Uses CSS transforms for robust docking alignment.

interface PreviewFloatingDockProps {
    app: ExploreAppCard;
    onClose: () => void;
    onOpenInNewTab: (url: string) => void;
    onDragStart: () => void;
    onDragEnd: () => void;
    isFullscreen: boolean;
    onToggleFullscreen: () => void;
    onOpenComments: () => void;
    onOpenSettings: () => void;
    settingsPending: boolean;
    dockOptions?: Omit<UseFloatingDockOptions, 'onDragStart' | 'onDragEnd'>;
    /**
     * Controls whether the dock action area is expanded by default.
     * - 'always': always expanded (unless dragging state overrides visuals)
     * - 'hover': collapsed by default, expands on hover
     * - 'auto': expands by default only when actionCount <= autoExpandMaxActions
     * @default 'auto'
     */
    expandPolicy?: 'always' | 'hover' | 'auto';
    /**
     * Threshold for expandPolicy='auto'.
     * @default 5
     */
    autoExpandMaxActions?: number;
}

export const PreviewFloatingDock: React.FC<PreviewFloatingDockProps> = ({
    app,
    onClose,
    onOpenInNewTab,
    onDragStart,
    onDragEnd,
    isFullscreen,
    onToggleFullscreen,
    dockOptions,
    onOpenComments,
    onOpenSettings,
    settingsPending,
    expandPolicy = 'auto',
    autoExpandMaxActions = 5,
}) => {
    const { t } = useTranslation();
    const presenter = usePresenter();
    const user = useAuthStore(s => s.user);
    const reactions = useReactionStore(s => s.byProjectId[app.id]);
    const [pinnedOpen, setPinnedOpen] = useState(false);
    const [reactionPending, setReactionPending] = useState(false);
    const pointerStart = useRef<{ x: number; y: number } | null>(null);
    const actionAreaId = useId();
    const isOwner = !!user && !!app.ownerId && user.id === app.ownerId;
    const toggleReaction = async (kind: 'like' | 'favorite') => {
        if (!presenter.auth.getCurrentUser()) {
            presenter.auth.openAuthModal('login');
            return;
        }
        if (reactionPending || reactions?.isLoading) return;
        setReactionPending(true);
        try {
            if (kind === 'like') await presenter.reaction.toggleLike(app.id);
            else await presenter.reaction.toggleFavorite(app.id);
        } finally {
            setReactionPending(false);
        }
    };

    const { nodeRef, style, onMouseDown, isDragging, dockSide } = useFloatingDock({
        onDragStart,
        onDragEnd,
        ...dockOptions,
    });

    const actionCount = 3 + (isOwner ? 1 : 0) + (app.url ? 1 : 0) + 2;
    const shouldAutoExpand =
        expandPolicy === 'always'
            ? true
            : expandPolicy === 'auto'
                ? actionCount <= autoExpandMaxActions
                : false;

    const expanded = pinnedOpen || shouldAutoExpand;
    const actionClass = 'flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-brand-50 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800';

    return (
        <div
            ref={nodeRef}
            onMouseDown={onMouseDown}
            style={style}
            className={`
                absolute z-50 select-none
                ${isDragging ? 'cursor-grabbing' : 'transition-[left,top] duration-500 linear cursor-grab'}
            `}
        >
            {/* Unified Capsule Container */}
            <div className={`
                flex flex-col items-center
                bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl
                border border-slate-200/60 dark:border-slate-700/60 shadow-[0_4px_16px_rgba(0,0,0,0.1)]
                transition-all duration-300 ease-out overflow-hidden
                group/dock
                ${dockSide === 'inside-left'
                    ? 'rounded-r-xl rounded-l-none border-l-0'
                    : 'rounded-l-xl rounded-r-none border-r-0'}
            `}>

                {/* 1. Main Icon (Always Visible) - Serves as Handle */}
                <button
                    type="button"
                    aria-label={t('previewActions.actions')}
                    aria-expanded={expanded}
                    aria-controls={actionAreaId}
                    title={t('previewActions.actions')}
                    onPointerDown={event => { pointerStart.current = { x: event.clientX, y: event.clientY }; }}
                    onClick={event => {
                        const start = pointerStart.current;
                        pointerStart.current = null;
                        if (event.detail === 0 || !start || Math.hypot(event.clientX - start.x, event.clientY - start.y) < 5) {
                            setPinnedOpen(value => !value);
                        }
                    }}
                    className="w-10 h-10 flex items-center justify-center flex-shrink-0 relative z-20 cursor-grab focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
                >
                    <BrandLogo className="w-5 h-5" />
                </button>

                {/* 2. Expanded Action Area */}
                <div id={actionAreaId} className={`
                    flex flex-col items-center gap-1 w-full
                    transition-all duration-300 ease-in-out origin-top px-1
                    ${isDragging || expanded
                        ? 'max-h-[340px] pb-2 opacity-100 visible'
                        : 'max-h-0 opacity-0 pb-0 invisible group-hover/dock:max-h-[340px] group-hover/dock:pb-2 group-hover/dock:opacity-100 group-hover/dock:visible group-focus-within/dock:max-h-[340px] group-focus-within/dock:pb-2 group-focus-within/dock:opacity-100 group-focus-within/dock:visible'}
                `}>

                    {/* Divider */}
                    <div className="w-3 h-px bg-slate-200 dark:bg-slate-700"></div>

                    <button type="button" onMouseDown={e => e.stopPropagation()} onClick={() => toggleReaction('like')}
                        disabled={reactionPending || reactions?.isLoading} aria-label={t('previewActions.like')} title={`${t('previewActions.like')} · ${reactions?.likesCount ?? 0}`} aria-pressed={reactions?.likedByCurrentUser ?? false} className={actionClass}>
                        <Heart className={`w-4 h-4 ${reactions?.likedByCurrentUser ? 'fill-rose-500 text-rose-500' : ''}`} />
                    </button>
                    <button type="button" onMouseDown={e => e.stopPropagation()} onClick={() => toggleReaction('favorite')}
                        disabled={reactionPending || reactions?.isLoading} aria-label={t('previewActions.favorite')} title={`${t('previewActions.favorite')} · ${reactions?.favoritesCount ?? 0}`} aria-pressed={reactions?.favoritedByCurrentUser ?? false} className={actionClass}>
                        <Star className={`w-4 h-4 ${reactions?.favoritedByCurrentUser ? 'fill-amber-400 text-amber-500' : ''}`} />
                    </button>
                    <button type="button" onMouseDown={e => e.stopPropagation()} onClick={onOpenComments} aria-label={t('previewActions.comments')} title={t('previewActions.comments')} className={actionClass}>
                        <MessageCircle className="w-4 h-4" />
                    </button>
                    {isOwner && <>
                        <div className="w-3 h-px bg-slate-200 dark:bg-slate-700" />
                        <button type="button" onMouseDown={e => e.stopPropagation()} onClick={onOpenSettings} disabled={settingsPending} aria-busy={settingsPending} aria-label={t('previewActions.settings')} title={t('previewActions.settings')} className={actionClass}>
                            <Settings className="w-4 h-4" />
                        </button>
                    </>}
                    <div className="w-3 h-px bg-slate-200 dark:bg-slate-700" />
                    {/* Browsing */}
                    {app.url && (
                        <button
                            onMouseDown={(e) => e.stopPropagation()}
                            data-event="app_visit" onClick={() => onOpenInNewTab(app.url!)}
                            className={actionClass}
                            aria-label={t('common.openInNewTab')} title={t('common.openInNewTab')}
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                    )}
                    <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={onToggleFullscreen}
                        className={actionClass}
                        aria-label={isFullscreen ? t('common.exitFullscreen') : t('common.fullscreen')}
                        title={
                            isFullscreen
                                ? t('common.exitFullscreen')
                                : t('common.fullscreen')
                        }
                    >
                        {isFullscreen ? (
                            <Minimize2 className="w-3.5 h-3.5" />
                        ) : (
                            <Maximize2 className="w-3.5 h-3.5" />
                        )}
                    </button>
                    <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={onClose}
                        className={`${actionClass} hover:!bg-red-50 hover:!text-red-600`}
                        aria-label={t('common.close')} title={t('common.close')}
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
};
