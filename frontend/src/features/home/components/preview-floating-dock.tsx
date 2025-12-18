import React, { useState, useRef } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ExploreAppCard } from '@/components/explore-app-card';

// ============================================================================
// STRATEGY: ROBUST CSS-BASED DOCKING
// ============================================================================
// Instead of relying on fragile pixel measurements for the "Docked" state (which can flake 
// due to sub-pixel rendering or width changes), we use CSS Transforms.
//
// 1. Outside Left: right-edge aligned to parent's left edge (left: 0, translateX(-100%)).
//    We add +1px overlap (calc(-100% + 1px)) to ensure visually seamless merging.
// 2. Inside Left: left-edge aligned to parent's left edge (left: 0, translateX(0)).
// 3. Inside Right: right-edge aligned to parent's right edge (left: 100%, translateX(-100%)).
//
// When dragging starts, we calculate the exact pixel position relative to the parent
// to ensure a smooth handover from "CSS Mode" to "Absolute Pixel Mode".
// ============================================================================

// --- CONSTANTS ---
type DockSide = 'outside-left' | 'inside-left' | 'inside-right';

// --- HELPER COMPONENTS ---
const Sector = ({ start, end, color }: { start: number; end: number; color: string }) => {
    const r = 12;
    const cx = 16;
    const cy = 16;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const x1 = cx + r * Math.cos(toRad(start));
    const y1 = cy + r * Math.sin(toRad(start));
    const x2 = cx + r * Math.cos(toRad(end));
    const y2 = cy + r * Math.sin(toRad(end));
    const largeArcFlag = end - start > 180 ? 1 : 0;
    return <path d={`M${cx} ${cy} L${x1} ${y1} A${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`} fill={color} />;
};

const BrandLogo = ({ className }: { className?: string }) => (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className={className}>
        <Sector start={-90} end={-30} color="#60a5fa" />
        <Sector start={0} end={90} color="#3b82f6" />
        <Sector start={90} end={180} color="#2563eb" />
        <Sector start={180} end={270} color="#1d4ed8" />
    </svg>
);

// --- LOGIC HOOK ---

const useFloatingDockBehavior = (
    onDragStart: () => void,
    onDragEnd: () => void
) => {
    // Default to absolute top (y=0), docked outside-left
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [dockSide, setDockSide] = useState<DockSide>('outside-left');
    const [isDragging, setIsDragging] = useState(false);
    const [isDocked, setIsDocked] = useState(true);

    const dragRef = useRef<{ startX: number, startY: number, initX: number, initY: number, currentX: number, currentY: number } | null>(null);
    const nodeRef = useRef<HTMLDivElement>(null);

    // Handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        onDragStart();

        // Calculate exact pixel position to prevent jump on drag start
        if (nodeRef.current && nodeRef.current.offsetParent) {
            const rect = nodeRef.current.getBoundingClientRect();
            const parentRect = nodeRef.current.offsetParent.getBoundingClientRect();
            const startX = rect.left - parentRect.left;

            // Sync state to exact pixels before un-docking
            setPosition({ x: startX, y: position.y });

            dragRef.current = {
                startX: e.clientX,
                startY: e.clientY,
                initX: startX,
                initY: position.y,
                currentX: startX,
                currentY: position.y
            };
        } else {
            // Fallback (rare)
            dragRef.current = {
                startX: e.clientX,
                startY: e.clientY,
                initX: position.x,
                initY: position.y,
                currentX: position.x,
                currentY: position.y
            };
        }

        setIsDragging(true);
        setIsDocked(false); // Enable unrestricted absolute positioning

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!dragRef.current) return;
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;

        const newX = dragRef.current.initX + dx;
        let newY = dragRef.current.initY + dy;

        // Bounded Y
        const maxHeight = window.innerHeight - (nodeRef.current?.offsetHeight || 100);
        newY = Math.max(0, Math.min(newY, maxHeight));

        // Update ref & state
        dragRef.current.currentX = newX;
        dragRef.current.currentY = newY;
        setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
        if (!dragRef.current || !nodeRef.current) return;

        const parentWidth = nodeRef.current.offsetParent?.clientWidth || window.innerWidth;
        const widgetWidth = nodeRef.current.offsetWidth;
        const currentCenter = dragRef.current.currentX + (widgetWidth / 2);

        // Determine snap target
        let newDockSide: DockSide = 'outside-left';
        if (currentCenter < 0) {
            newDockSide = 'outside-left';
        } else if (currentCenter < parentWidth / 2) {
            newDockSide = 'inside-left';
        } else {
            newDockSide = 'inside-right';
        }

        const maxHeight = (nodeRef.current.offsetParent?.clientHeight || window.innerHeight) - nodeRef.current.offsetHeight;
        const finalY = Math.max(0, Math.min(dragRef.current.currentY, maxHeight));

        // Commit Stickiness
        setDockSide(newDockSide);
        setPosition({ x: 0, y: finalY }); // x is reset/ignored when docked
        setIsDocked(true);
        setIsDragging(false);

        onDragEnd();

        dragRef.current = null;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    };

    // Calculate Dynamic Styles
    const style: React.CSSProperties = isDocked
        ? {
            top: position.y,
            left: dockSide === 'outside-left' || dockSide === 'inside-left' ? 0 : '100%',
            transform: dockSide === 'outside-left'
                ? 'translateX(calc(-100% + 1px))' // +1px for seamless overlap
                : dockSide === 'inside-right'
                    ? 'translateX(-100%)'
                    : 'none'
        }
        : {
            left: position.x,
            top: position.y
        };

    return {
        nodeRef,
        style,
        handlers: { onMouseDown: handleMouseDown },
        state: { isDragging, dockSide }
    };
};

// --- MAIN COMPONENT ---

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

    // Use the logic hook
    const { nodeRef, style, handlers, state } = useFloatingDockBehavior(onDragStart, onDragEnd);
    const { isDragging, dockSide } = state;

    return (
        <div
            ref={nodeRef}
            onMouseDown={handlers.onMouseDown}
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
