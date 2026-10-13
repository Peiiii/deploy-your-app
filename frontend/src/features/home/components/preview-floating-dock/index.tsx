import {
  FloatingDock,
  FloatingDockAction,
  FloatingDockDivider,
  FloatingDockIdentity,
} from '@/components/floating-dock';
import React, { useId, useState } from 'react';
import {
  ExternalLink,
  ThumbsUp,
  MessageCircle,
  Star,
  Settings,
  Maximize2,
  Minimize2,
  X,
} from 'lucide-react';
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
  commentsOpen: boolean;
  commentsPanelId: string;
  commentsButtonRef: React.RefObject<HTMLButtonElement | null>;
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
  commentsOpen,
  commentsPanelId,
  commentsButtonRef,
  onOpenSettings,
  settingsPending,
  expandPolicy = 'auto',
  autoExpandMaxActions = 5,
}) => {
  const { t } = useTranslation();
  const presenter = usePresenter();
  const user = useAuthStore((s) => s.user);
  const reactions = useReactionStore((s) => s.byProjectId[app.id]);
  const [reactionPending, setReactionPending] = useState(false);
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

  const expanded = shouldAutoExpand;

  return (
    <FloatingDock
      label={t('previewActions.actions')}
      nodeRef={nodeRef}
      style={style}
      dockSide={dockSide}
      isDragging={isDragging}
      animatePosition={dockOptions?.bottomInset === undefined}
      expanded={expanded}
      actionAreaId={actionAreaId}
      handle={
        <FloatingDockIdentity label="GemiGo" onMouseDown={onMouseDown}>
          <BrandLogo />
        </FloatingDockIdentity>
      }
    >
      {/* Divider */}
      <FloatingDockDivider />

      <FloatingDockAction
        tooltip={String(reactions?.likesCount ?? 0)}
        label={t('previewActions.like')}
        type="button"
        onClick={() => toggleReaction('like')}
        disabled={reactionPending || reactions?.isLoading}
        aria-pressed={reactions?.likedByCurrentUser ?? false}
      >
        <ThumbsUp className={reactions?.likedByCurrentUser ? 'fill-rose-500 text-rose-500' : ''} />
      </FloatingDockAction>
      <FloatingDockAction
        tooltip={String(reactions?.favoritesCount ?? 0)}
        label={t('previewActions.favorite')}
        type="button"
        onClick={() => toggleReaction('favorite')}
        disabled={reactionPending || reactions?.isLoading}
        aria-pressed={reactions?.favoritedByCurrentUser ?? false}
      >
        <Star
          className={reactions?.favoritedByCurrentUser ? 'fill-amber-400 text-amber-500' : ''}
        />
      </FloatingDockAction>
      <FloatingDockAction
        label={t('previewActions.comments')}
        ref={commentsButtonRef}
        type="button"
        onClick={onOpenComments}
        aria-expanded={commentsOpen}
        aria-controls={commentsPanelId}
      >
        <MessageCircle />
      </FloatingDockAction>
      {isOwner && (
        <>
          <FloatingDockDivider />
          <FloatingDockAction
            label={t('previewActions.settings')}
            type="button"
            onClick={onOpenSettings}
            disabled={settingsPending}
            aria-busy={settingsPending}
          >
            <Settings />
          </FloatingDockAction>
        </>
      )}
      <FloatingDockDivider />
      {/* Browsing */}
      {app.url && (
        <FloatingDockAction
          label={t('common.openInNewTab')}
          data-event="app_visit"
          onClick={() => onOpenInNewTab(app.url!)}
        >
          <ExternalLink />
        </FloatingDockAction>
      )}
      <FloatingDockAction
        label={isFullscreen ? t('common.exitFullscreen') : t('common.fullscreen')}
        onClick={onToggleFullscreen}
      >
        {isFullscreen ? <Minimize2 /> : <Maximize2 />}
      </FloatingDockAction>
      <FloatingDockAction label={t('common.close')} onClick={onClose} feedbackTone="danger">
        <X />
      </FloatingDockAction>
    </FloatingDock>
  );
};
