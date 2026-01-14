import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Minimize2, X } from 'lucide-react';
import type { ExploreAppCard } from '@/components/explore-app-card';
import { PreviewFloatingDock } from './preview-floating-dock';
import { useUIStore } from '@/stores/ui.store';

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
    const [isDragging, setIsDragging] = useState(false);
    const rightPanelLayout = useUIStore((s) => s.rightPanelLayout);
    const toggleRightPanelLayout = useUIStore((s) => s.actions.toggleRightPanelLayout);
    const setRightPanelLayout = useUIStore((s) => s.actions.setRightPanelLayout);
    const isFullscreen = rightPanelLayout === 'fullscreen';

    useEffect(() => {
        if (!isFullscreen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setRightPanelLayout('half');
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isFullscreen, setRightPanelLayout]);

    // Pass dragging state down to block iframe events
    return (
        <div className="relative w-full h-full bg-white dark:bg-slate-900 shadow-2xl">
            {isFullscreen && (
                <div className="absolute top-4 right-4 z-[60] flex items-center gap-2">
                    {app.url && (
                        <button
                            type="button"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={() => onOpenInNewTab(app.url!)}
                            className="w-10 h-10 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white hover:text-brand-600 dark:hover:bg-slate-900 dark:hover:text-brand-400 transition-colors"
                            title={t('common.openInNewTab')}
                            aria-label={t('common.openInNewTab')}
                        >
                            <ExternalLink className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={() => setRightPanelLayout('half')}
                        className="w-10 h-10 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white hover:text-slate-900 dark:hover:bg-slate-900 dark:hover:text-white transition-colors"
                        title={t('common.exitFullscreen')}
                        aria-label={t('common.exitFullscreen')}
                    >
                        <Minimize2 className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={onClose}
                        className="w-10 h-10 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-colors"
                        title={t('common.close')}
                        aria-label={t('common.close')}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Content Wrapper (Clipped) */}
            <div className="absolute inset-0 overflow-hidden">
                {/* Glass Edge Effect */}
                <div className="absolute inset-y-0 left-0 w-[1px] z-50 pointer-events-none bg-gradient-to-b from-white/0 via-white/80 to-white/0 dark:from-white/0 dark:via-white/20 dark:to-white/0 opacity-50"></div>
                <div className="absolute inset-y-0 left-0 w-6 z-40 pointer-events-none bg-gradient-to-r from-slate-900/5 to-transparent dark:from-black/40 dark:to-transparent mix-blend-overlay"></div>

                {/* Iframe Content */}
                <div className={`absolute inset-0 z-0 bg-slate-100 dark:bg-slate-950 ${isDragging ? 'pointer-events-none' : ''}`}>
                    {app.url ? (
                        <iframe
                            src={app.url}
                            className="w-full h-full border-0 select-none"
                            title={app.name}
                            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
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

            {/* Draggable Widget (Unified Dock) */}
            <PreviewFloatingDock
                app={app}
                onClose={onClose}
                onOpenInNewTab={onOpenInNewTab}
                onDragStart={() => setIsDragging(true)}
                onDragEnd={() => setIsDragging(false)}
                isFullscreen={isFullscreen}
                onToggleFullscreen={toggleRightPanelLayout}
            />
        </div>
    );
};
