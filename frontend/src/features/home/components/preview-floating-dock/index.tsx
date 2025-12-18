import React from 'react';
import { ExternalLink, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ExploreAppCard } from '@/components/explore-app-card';
import { useFloatingDock } from './use-floating-dock';
import { BrandLogo } from './brand-logo';

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
}

export const PreviewFloatingDock: React.FC<PreviewFloatingDockProps> = ({
    app,
    onClose,
    onOpenInNewTab,
    onDragStart,
    onDragEnd
}) => {
    const { t } = useTranslation();

    const { nodeRef, style, onMouseDown, isDragging, dockSide } = useFloatingDock({
        onDragStart,
        onDragEnd
    });

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
                <div className="w-8 h-8 flex items-center justify-center flex-shrink-0 relative z-20">
                    <BrandLogo className="w-5 h-5" />
                </div>

                {/* 2. Expanded Action Area */}
                <div className={`
                    flex flex-col items-center gap-2 w-full
                    transition-all duration-300 ease-in-out origin-top px-1
                    ${isDragging
                        ? 'max-h-[100px] pb-2 opacity-100'
                        : 'max-h-0 opacity-0 pb-0 group-hover/dock:max-h-[100px] group-hover/dock:pb-2 group-hover/dock:opacity-100'}
                `}>

                    {/* Divider */}
                    <div className="w-3 h-px bg-slate-200 dark:bg-slate-700"></div>

                    {/* Actions */}
                    {app.url && (
                        <button
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={() => onOpenInNewTab(app.url!)}
                            className="p-1 rounded-md hover:bg-brand-50 hover:text-brand-600 text-slate-500 dark:text-slate-400 transition-colors"
                            title={t('common.openInNewTab')}
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                    )}
                    <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={onClose}
                        className="p-1 rounded-md hover:bg-red-50 hover:text-red-600 text-slate-500 dark:text-slate-400 transition-colors"
                        title={t('common.close')}
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
};
