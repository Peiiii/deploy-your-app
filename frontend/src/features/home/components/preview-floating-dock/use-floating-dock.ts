import { useState, useRef, useEffect, useMemo } from 'react';
import { useMemoizedFn } from 'ahooks';
import { DOCK_OVERLAP_PX, DEFAULT_INITIAL_POSITION, type DockSide, type InitialPosition } from './types';

// ============================================================================
// SIMPLIFIED FLOATING DOCK HOOK
// ============================================================================
// Two modes: 'docked' (CSS transform positioning) or 'dragging' (pixel positioning)
// ============================================================================

export interface UseFloatingDockOptions {
    onDragStart?: () => void;
    onDragEnd?: () => void;
    initialPosition?: InitialPosition;
}

export interface UseFloatingDockReturn {
    nodeRef: React.RefObject<HTMLDivElement | null>;
    style: React.CSSProperties;
    onMouseDown: (e: React.MouseEvent) => void;
    isDragging: boolean;
    dockSide: DockSide;
}

export const useFloatingDock = (options: UseFloatingDockOptions = {}): UseFloatingDockReturn => {
    const { onDragStart, onDragEnd, initialPosition = DEFAULT_INITIAL_POSITION } = options;

    // Single state object for simplicity
    const [state, setState] = useState({
        mode: 'docked' as 'docked' | 'dragging',
        dockSide: initialPosition.dockSide,
        x: 0,
        y: initialPosition.y
    });

    const nodeRef = useRef<HTMLDivElement>(null);
    const dragStartRef = useRef({ mouseX: 0, mouseY: 0, widgetX: 0, widgetY: 0 });

    // --- Mouse Down: Start Dragging ---
    const onMouseDown = useMemoizedFn((e: React.MouseEvent) => {
        e.preventDefault();

        // Get current pixel position from rendered element
        const node = nodeRef.current;
        const parent = node?.offsetParent as HTMLElement;
        if (!node || !parent) return;

        const rect = node.getBoundingClientRect();
        const parentRect = parent.getBoundingClientRect();
        const startX = rect.left - parentRect.left;

        dragStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, widgetX: startX, widgetY: state.y };
        setState(s => ({ ...s, mode: 'dragging', x: startX }));
        onDragStart?.();
    });

    // --- Mouse Move & Up: Managed by useEffect ---
    useEffect(() => {
        if (state.mode !== 'dragging') return;

        const onMove = (e: MouseEvent) => {
            const dx = e.clientX - dragStartRef.current.mouseX;
            const dy = e.clientY - dragStartRef.current.mouseY;
            const newX = dragStartRef.current.widgetX + dx;
            const newY = Math.max(0, dragStartRef.current.widgetY + dy);
            setState(s => ({ ...s, x: newX, y: newY }));
        };

        const onUp = () => {
            const node = nodeRef.current;
            const parent = node?.offsetParent as HTMLElement;
            const parentWidth = parent?.clientWidth ?? window.innerWidth;
            const widgetWidth = node?.offsetWidth ?? 0;

            setState(s => {
                const actualCenterX = s.x + widgetWidth / 2;
                const newDockSide: DockSide =
                    actualCenterX < 0 ? 'outside-left' :
                        actualCenterX < parentWidth / 2 ? 'inside-left' : 'inside-right';

                return { mode: 'docked', dockSide: newDockSide, x: 0, y: s.y };
            });
            onDragEnd?.();
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        return () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
    }, [state.mode, onDragEnd]);

    // --- Style Calculation ---
    const style = useMemo((): React.CSSProperties => {
        if (state.mode === 'dragging') {
            return { left: state.x, top: state.y };
        }

        // Docked: use CSS transforms
        const isLeft = state.dockSide !== 'inside-right';
        return {
            top: state.y,
            left: isLeft ? 0 : '100%',
            transform: state.dockSide === 'outside-left'
                ? `translateX(calc(-100% + ${DOCK_OVERLAP_PX}px))`
                : state.dockSide === 'inside-right'
                    ? 'translateX(-100%)'
                    : 'none'
        };
    }, [state.mode, state.dockSide, state.x, state.y]);

    return { nodeRef, style, onMouseDown, isDragging: state.mode === 'dragging', dockSide: state.dockSide };
};
