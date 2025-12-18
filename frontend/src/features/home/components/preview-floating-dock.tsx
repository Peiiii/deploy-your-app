import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useMemoizedFn } from 'ahooks';
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
//    We add +DOCK_OVERLAP overlap (calc(-100% + 1px)) to ensure visually seamless merging.
// 2. Inside Left: left-edge aligned to parent's left edge (left: 0, translateX(0)).
// 3. Inside Right: right-edge aligned to parent's right edge (left: 100%, translateX(-100%)).
//
// When dragging starts, we calculate the exact pixel position relative to the parent
// to ensure a smooth handover from "CSS Mode" to "Absolute Pixel Mode".
// ============================================================================

// ============================================================================
// CONSTANTS
// ============================================================================

/** Overlap in pixels for seamless edge merging when docked outside */
const DOCK_OVERLAP_PX = 1;

/** Default widget height fallback for boundary calculations */
const DEFAULT_WIDGET_HEIGHT = 100;

/** Possible docking positions */
type DockSide = 'outside-left' | 'inside-left' | 'inside-right';

/** State machine: docked (CSS positioning) or dragging (absolute pixel positioning) */
type DockMode = 'docked' | 'dragging';

/** Drag session data stored in ref to avoid stale closures */
interface DragSession {
    startMouseX: number;
    startMouseY: number;
    initialWidgetX: number;
    initialWidgetY: number;
    currentX: number;
    currentY: number;
}

/** Initial position configuration */
interface InitialPosition {
    y: number;
    dockSide: DockSide;
}

const DEFAULT_INITIAL_POSITION: InitialPosition = {
    y: 0,
    dockSide: 'outside-left'
};

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

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

// ============================================================================
// LOGIC HOOK: useFloatingDockBehavior
// ============================================================================
// Uses a state machine pattern with two modes:
// - 'docked': Widget is attached to an edge, positioned via CSS transforms
// - 'dragging': Widget is being moved, positioned via absolute pixel coordinates
// ============================================================================

interface UseFloatingDockBehaviorOptions {
    onDragStart?: () => void;
    onDragEnd?: () => void;
    initialPosition?: InitialPosition;
}

interface UseFloatingDockBehaviorReturn {
    nodeRef: React.RefObject<HTMLDivElement | null>;
    style: React.CSSProperties;
    handlers: { onMouseDown: (e: React.MouseEvent) => void };
    state: { isDragging: boolean; dockSide: DockSide };
}

const useFloatingDockBehavior = (
    options: UseFloatingDockBehaviorOptions = {}
): UseFloatingDockBehaviorReturn => {
    const {
        onDragStart,
        onDragEnd,
        initialPosition = DEFAULT_INITIAL_POSITION
    } = options;

    // --- Core State (State Machine) ---
    const [mode, setMode] = useState<DockMode>('docked');
    const [dockSide, setDockSide] = useState<DockSide>(initialPosition.dockSide);
    const [position, setPosition] = useState({ x: 0, y: initialPosition.y });

    // --- Refs ---
    const nodeRef = useRef<HTMLDivElement>(null);
    const dragSessionRef = useRef<DragSession | null>(null);

    // --- Derived State ---
    const isDragging = mode === 'dragging';

    // --- Utility Functions (Stable via useMemoizedFn) ---

    const getParentDimensions = useMemoizedFn(() => {
        const parent = nodeRef.current?.offsetParent as HTMLElement | null;
        return {
            width: parent?.clientWidth ?? window.innerWidth,
            height: parent?.clientHeight ?? window.innerHeight
        };
    });

    const getWidgetDimensions = useMemoizedFn(() => {
        return {
            width: nodeRef.current?.offsetWidth ?? 0,
            height: nodeRef.current?.offsetHeight ?? DEFAULT_WIDGET_HEIGHT
        };
    });

    const clampY = useMemoizedFn((y: number): number => {
        const { height: parentHeight } = getParentDimensions();
        const { height: widgetHeight } = getWidgetDimensions();
        const maxY = parentHeight - widgetHeight;
        return Math.max(0, Math.min(y, maxY));
    });

    const determineDockSide = useMemoizedFn((centerX: number): DockSide => {
        const { width: parentWidth } = getParentDimensions();
        if (centerX < 0) return 'outside-left';
        if (centerX < parentWidth / 2) return 'inside-left';
        return 'inside-right';
    });

    const calculateInitialPixelPosition = useMemoizedFn((): { x: number; y: number } => {
        if (!nodeRef.current || !nodeRef.current.offsetParent) {
            return { x: position.x, y: position.y };
        }
        const rect = nodeRef.current.getBoundingClientRect();
        const parentRect = nodeRef.current.offsetParent.getBoundingClientRect();
        return {
            x: rect.left - parentRect.left,
            y: position.y
        };
    });

    // --- Event Handlers (Stable via useMemoizedFn) ---

    const handleMouseMove = useMemoizedFn((e: MouseEvent) => {
        const session = dragSessionRef.current;
        if (!session) return;

        const dx = e.clientX - session.startMouseX;
        const dy = e.clientY - session.startMouseY;

        const newX = session.initialWidgetX + dx;
        const newY = clampY(session.initialWidgetY + dy);

        // Update session ref (no re-render)
        session.currentX = newX;
        session.currentY = newY;

        // Update state for rendering
        setPosition({ x: newX, y: newY });
    });

    const handleMouseUp = useMemoizedFn(() => {
        const session = dragSessionRef.current;
        if (!session || !nodeRef.current) return;

        const { width: widgetWidth } = getWidgetDimensions();
        const centerX = session.currentX + widgetWidth / 2;

        const newDockSide = determineDockSide(centerX);
        const finalY = clampY(session.currentY);

        // Transition back to docked mode
        setDockSide(newDockSide);
        setPosition({ x: 0, y: finalY }); // x is ignored in docked mode
        setMode('docked');

        // Cleanup session
        dragSessionRef.current = null;

        onDragEnd?.();
    });

    const handleMouseDown = useMemoizedFn((e: React.MouseEvent) => {
        e.preventDefault();

        // Calculate current pixel position from CSS
        const { x: pixelX, y: pixelY } = calculateInitialPixelPosition();

        // Initialize drag session
        dragSessionRef.current = {
            startMouseX: e.clientX,
            startMouseY: e.clientY,
            initialWidgetX: pixelX,
            initialWidgetY: pixelY,
            currentX: pixelX,
            currentY: pixelY
        };

        // Transition to dragging mode
        setPosition({ x: pixelX, y: pixelY });
        setMode('dragging');

        onDragStart?.();
    });

    // --- Event Listener Management via useEffect ---
    // Attach/detach global listeners based on mode to avoid circular references
    useEffect(() => {
        if (mode !== 'dragging') return;

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [mode, handleMouseMove, handleMouseUp]);

    // --- Style Calculation (Memoized) ---
    const style = useMemo((): React.CSSProperties => {
        if (mode === 'dragging') {
            return { left: position.x, top: position.y };
        }

        // Docked mode: use CSS transforms for robust alignment
        const isLeftSide = dockSide === 'outside-left' || dockSide === 'inside-left';
        const transform = dockSide === 'outside-left'
            ? `translateX(calc(-100% + ${DOCK_OVERLAP_PX}px))`
            : dockSide === 'inside-right'
                ? 'translateX(-100%)'
                : 'none';

        return {
            top: position.y,
            left: isLeftSide ? 0 : '100%',
            transform
        };
    }, [mode, dockSide, position.x, position.y]);

    return {
        nodeRef,
        style,
        handlers: { onMouseDown: handleMouseDown },
        state: { isDragging, dockSide }
    };
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

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

    const { nodeRef, style, handlers, state } = useFloatingDockBehavior({
        onDragStart,
        onDragEnd
    });
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
