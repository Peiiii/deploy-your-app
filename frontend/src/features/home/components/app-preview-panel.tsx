import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import type { ExploreAppCard } from '@/components/explore-app-card';
import { PreviewFloatingDock } from './preview-floating-dock';
import { useUIStore } from '@/stores/ui.store';
import { useNavigate } from 'react-router-dom';
import { usePresenter } from '@/contexts/presenter-context';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { PreviewCommentsPanel } from './preview-comments-panel';
import { AppPreviewContent } from './app-preview-content';

interface AppPreviewPanelProps {
    app: ExploreAppCard;
    onClose: () => void;
    onOpenInNewTab: (url: string) => void;
}

export const AppPreviewPanel: React.FC<AppPreviewPanelProps> = ({
    app,
    onClose,
    onOpenInNewTab,
}) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const presenter = usePresenter();
    const userId = useAuthStore(s => s.user?.id);
    const activeAppId = useRef<string | null>(app.id);
    const [pendingSettingsAppId, setPendingSettingsAppId] = useState<string | null>(null);
    const settingsPending = pendingSettingsAppId === app.id;
    useEffect(() => {
        activeAppId.current = app.id;
        return () => { activeAppId.current = null; };
    }, [app.id]);
    const [commentsAppId, setCommentsAppId] = useState<string | null>(null);
    const commentsOpen = commentsAppId === app.id;
    const commentsPanelId = useId();
    const commentsButtonRef = useRef<HTMLButtonElement>(null);
    const closeComments = React.useCallback(() => {
        if (document.getElementById(commentsPanelId)?.contains(document.activeElement)) {
            commentsButtonRef.current?.focus();
        }
        setCommentsAppId(null);
    }, [commentsPanelId]);
    const [isDragging, setIsDragging] = useState(false);
    const rightPanelLayout = useUIStore((s) => s.rightPanelLayout);
    const toggleRightPanelLayout = useUIStore((s) => s.actions.toggleRightPanelLayout);
    const setRightPanelLayout = useUIStore((s) => s.actions.setRightPanelLayout);
    const isFullscreen = rightPanelLayout === 'fullscreen';

    useEffect(() => {
        void presenter.reaction.loadReactionsForProject(app.id);
    }, [app.id, userId, presenter.reaction]);

    useEffect(() => {
        queueMicrotask(() => setIsDragging(false));
    }, [isFullscreen]);

    const dockStateKeyBase = useMemo(() => {
        const base = app.id || app.url || app.name;
        return `preview-dock:${base}`;
    }, [app.id, app.name, app.url]);

    const dockOptionsHalf = useMemo(() => {
        return {
            stateKey: `${dockStateKeyBase}:half`,
        };
    }, [dockStateKeyBase]);

    const dockOptionsFullscreen = useMemo(() => {
        return {
            stateKey: `${dockStateKeyBase}:fullscreen`,
            allowOutsideLeft: false,
            initialPosition: {
                y: 16,
                dockSide: 'inside-left' as const,
            },
        };
    }, [dockStateKeyBase]);

    useEffect(() => {
        if (!isFullscreen && !commentsOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Escape' || e.isComposing || e.defaultPrevented || useAuthStore.getState().modalOpen) return;
            if (commentsOpen) {
                e.preventDefault();
                closeComments();
            } else {
                setRightPanelLayout('half');
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isFullscreen, commentsOpen, closeComments, setRightPanelLayout]);

    // Pass dragging state down to block iframe events
    return (
        <div
            className={`relative w-full h-full ${isFullscreen
                ? 'bg-transparent shadow-none'
                : 'bg-white dark:bg-slate-900 shadow-2xl'
                }`}
        >

            {/* Content Wrapper (Clipped) */}
            <div className="absolute inset-0 flex overflow-hidden">
                <div
                    aria-hidden={!commentsOpen}
                    inert={!commentsOpen}
                    className={`h-full w-[min(320px,45%)] min-w-0 shrink-0 transition-[margin-left,opacity] duration-[240ms] ease-out motion-reduce:transition-none ${commentsOpen ? 'ml-0 opacity-100' : '-ml-[min(320px,45%)] opacity-0'}`}
                >
                    <PreviewCommentsPanel
                        key={app.id}
                        projectId={app.id}
                        panelId={commentsPanelId}
                        appName={app.name}
                        open={commentsOpen}
                        isFullscreen={isFullscreen}
                        onClose={closeComments}
                    />
                </div>
                <div className="relative h-full min-w-0 flex-1 overflow-hidden">
                    {/* Glass Edge Effect */}
                    {!isFullscreen && (
                        <>
                            <div className="absolute inset-y-0 left-0 w-[1px] z-50 pointer-events-none bg-gradient-to-b from-white/0 via-white/80 to-white/0 dark:from-white/0 dark:via-white/20 dark:to-white/0 opacity-50"></div>
                            <div className="absolute inset-y-0 left-0 w-6 z-40 pointer-events-none bg-gradient-to-r from-slate-900/5 to-transparent dark:from-black/40 dark:to-transparent mix-blend-overlay"></div>
                        </>
                    )}

                    {/* Iframe Content */}
                    <div className={`absolute inset-0 z-0 bg-slate-100 dark:bg-slate-950 ${isDragging ? 'pointer-events-none' : ''}`}>
                        {app.url ? (
                            <AppPreviewContent
                                url={app.url}
                                name={app.name}
                                onOpenInNewTab={onOpenInNewTab}
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-center space-y-3">
                                    <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                                        <X className="w-8 h-8 text-slate-400" />
                                    </div>
                                    <p className="text-slate-500 dark:text-slate-400 font-medium">
                                        {t('common.notAccessible')}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Draggable Widget (Unified Dock) */}
            <PreviewFloatingDock
                key={isFullscreen ? 'fullscreen' : 'half'}
                app={app}
                onClose={onClose}
                onOpenInNewTab={onOpenInNewTab}
                onDragStart={() => setIsDragging(true)}
                onDragEnd={() => setIsDragging(false)}
                isFullscreen={isFullscreen}
                onToggleFullscreen={toggleRightPanelLayout}
                dockOptions={isFullscreen ? dockOptionsFullscreen : dockOptionsHalf}
                expandPolicy={isFullscreen && !commentsOpen ? 'hover' : 'always'}
                commentsOpen={commentsOpen}
                commentsPanelId={commentsPanelId}
                commentsButtonRef={commentsButtonRef}
                onOpenComments={() => setCommentsAppId(current => current === app.id ? null : app.id)}
                settingsPending={settingsPending}
                onOpenSettings={async () => {
                    if (settingsPending) return;
                    const userId = presenter.auth.getCurrentUser()?.id;
                    if (!userId || userId !== app.ownerId) return;
                    setPendingSettingsAppId(app.id);
                    try {
                        await presenter.project.ensureProjectLoaded(app.id, userId);
                        if (presenter.auth.getCurrentUser()?.id !== userId || activeAppId.current !== app.id) return;
                        onClose();
                        navigate(`/projects/${encodeURIComponent(app.id)}`);
                    } catch {
                        if (activeAppId.current === app.id) presenter.ui.showToast(t('common.error'), 'error');
                    } finally {
                        if (activeAppId.current === app.id) setPendingSettingsAppId(null);
                    }
                }}
            />
        </div>
    );
};
