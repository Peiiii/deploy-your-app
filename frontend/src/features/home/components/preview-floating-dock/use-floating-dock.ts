import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useMemoizedFn } from 'ahooks';
import {
    DOCK_OVERLAP_PX,
    DEFAULT_WIDGET_HEIGHT,
    DEFAULT_INITIAL_POSITION,
    type DockSide,
    type DockMode,
    type DragSession,
    type InitialPosition
} from './types';

// ============================================================================
// HOOK: useFloatingDockBehavior
// ============================================================================
// Uses a state machine pattern with two modes:
// - 'docked': Widget is attached to an edge, positioned via CSS transforms
// - 'dragging': Widget is being moved, positioned via absolute pixel coordinates
//
// STRATEGY: ROBUST CSS-BASED DOCKING
// Instead of relying on fragile pixel measurements for the "Docked" state,
// we use CSS Transforms:
// 1. Outside Left: translateX(calc(-100% + 1px)) for seamless merging
// 2. Inside Left: translateX(0)
// 3. Inside Right: left: 100%, translateX(-100%)
// ============================================================================

export interface UseFloatingDockBehaviorOptions {
    onDragStart?: () => void;
    onDragEnd?: () => void;
    initialPosition?: InitialPosition;
}

export interface UseFloatingDockBehaviorReturn {
    nodeRef: React.RefObject<HTMLDivElement | null>;
    style: React.CSSProperties;
    handlers: { onMouseDown: (e: React.MouseEvent) => void };
    state: { isDragging: boolean; dockSide: DockSide };
}

export const useFloatingDockBehavior = (
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
