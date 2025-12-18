import { useState, useRef, useEffect, useMemo } from 'react';
import { useMemoizedFn } from 'ahooks';
import { DEFAULT_INITIAL_POSITION, type DockSide, type InitialPosition } from './types';
import { determineDockSide, getDockedStyle, getDraggingStyle, getRelativePosition } from './utils';

// ============================================================================
// FLOATING DOCK HOOK
// ============================================================================
// Two modes: 'docked' (CSS transform) or 'dragging' (pixel positioning)
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

    const [state, setState] = useState({
        mode: 'docked' as 'docked' | 'dragging',
        dockSide: initialPosition.dockSide,
        x: 0,
        y: initialPosition.y
    });

    const nodeRef = useRef<HTMLDivElement>(null);
    const dragStartRef = useRef({ mouseX: 0, mouseY: 0, widgetX: 0, widgetY: 0 });

    // --- Start Dragging ---
    const onMouseDown = useMemoizedFn((e: React.MouseEvent) => {
        e.preventDefault();
        const pos = getRelativePosition(nodeRef.current);
        if (!pos) return;

        dragStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, widgetX: pos.x, widgetY: state.y };
        setState(s => ({ ...s, mode: 'dragging', x: pos.x }));
        onDragStart?.();
    });

    // --- Dragging & Drop ---
    useEffect(() => {
        if (state.mode !== 'dragging') return;

        const onMove = (e: MouseEvent) => {
            const dx = e.clientX - dragStartRef.current.mouseX;
            const dy = e.clientY - dragStartRef.current.mouseY;
            setState(s => ({
                ...s,
                x: dragStartRef.current.widgetX + dx,
                y: Math.max(0, dragStartRef.current.widgetY + dy)
            }));
        };

        const onUp = () => {
            const node = nodeRef.current;
            const parent = node?.offsetParent as HTMLElement;
            const parentWidth = parent?.clientWidth ?? window.innerWidth;
            const widgetWidth = node?.offsetWidth ?? 0;

            setState(s => ({
                mode: 'docked',
                dockSide: determineDockSide(s.x + widgetWidth / 2, parentWidth),
                x: 0,
                y: s.y
            }));
            onDragEnd?.();
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        return () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
    }, [state.mode, onDragEnd]);

    // --- Style ---
    const style = useMemo(
        () => state.mode === 'dragging'
            ? getDraggingStyle(state.x, state.y)
            : getDockedStyle(state.dockSide, state.y),
        [state.mode, state.dockSide, state.x, state.y]
    );

    return { nodeRef, style, onMouseDown, isDragging: state.mode === 'dragging', dockSide: state.dockSide };
};
