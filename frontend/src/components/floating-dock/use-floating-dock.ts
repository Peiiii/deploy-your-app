import { useState, useRef, useEffect, useMemo } from 'react';
import { useMemoizedFn } from 'ahooks';
import {
  DEFAULT_INITIAL_POSITION,
  DOCK_DRAG_THRESHOLD_PX,
  type DockSide,
  type DockMode,
  type InitialPosition,
} from './types';
import {
  determineDockSide,
  getDockedStyle,
  getDraggingStyle,
  getRelativePosition,
} from './utils';

// ============================================================================
// FLOATING DOCK HOOK
// ============================================================================
// Pending clicks keep CSS docking; established drags use pixel positioning.
// ============================================================================

type PersistedDockState = { dockSide: DockSide; y: number };
const dockStateByKey = new Map<string, PersistedDockState>();

export interface UseFloatingDockOptions {
  onDragStart?: () => void;
  onDragEnd?: () => void;
  initialPosition?: InitialPosition;
  /**
   * Optional in-memory persistence key. When provided, the dock will remember
   * its dockSide/y between mounts for that key.
   */
  stateKey?: string;
  /**
   * When false, the dock will never settle into the "outside-left" position,
   * preventing it from being mostly hidden off-screen (useful for fullscreen).
   * @default true
   */
  allowOutsideLeft?: boolean;
}

export interface UseFloatingDockReturn {
  nodeRef: React.RefObject<HTMLDivElement | null>;
  style: React.CSSProperties;
  onMouseDown: (e: React.MouseEvent) => void;
  isDragging: boolean;
  dockSide: DockSide;
}

export const useFloatingDock = (
  options: UseFloatingDockOptions = {},
): UseFloatingDockReturn => {
  const {
    onDragStart,
    onDragEnd,
    initialPosition = DEFAULT_INITIAL_POSITION,
    allowOutsideLeft = true,
    stateKey,
  } = options;

  const [state, setState] = useState(() => {
    const persisted = stateKey ? dockStateByKey.get(stateKey) : undefined;
    return {
      mode: 'docked' as DockMode,
      dockSide: persisted?.dockSide ?? initialPosition.dockSide,
      x: 0,
      y: persisted?.y ?? initialPosition.y,
    };
  });

  const nodeRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, widgetX: 0, widgetY: 0, started: false });

  // If the caller disallows "outside-left" (e.g. fullscreen), ensure the dock
  // is always visible even if it was previously parked outside the viewport.
  useEffect(() => {
    if (allowOutsideLeft) return;
    queueMicrotask(() => {
      setState((s) => {
        if (s.mode !== 'docked') return s;
        if (s.dockSide !== 'outside-left') return s;

        const nextDockSide: DockSide =
          initialPosition.dockSide === 'outside-left'
            ? 'inside-left'
            : initialPosition.dockSide;

        return {
          ...s,
          dockSide: nextDockSide,
          y: initialPosition.y,
        };
      });
    });
  }, [allowOutsideLeft, initialPosition.dockSide, initialPosition.y]);

  // --- Start Dragging ---
  const onMouseDown = useMemoizedFn((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const pos = getRelativePosition(nodeRef.current);
    if (!pos) return;

    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      widgetX: pos.x,
      widgetY: state.y,
      started: false,
    };
    setState((s) => ({ ...s, mode: 'pending' }));
  });

  // --- Dragging & Drop ---
  useEffect(() => {
    if (state.mode === 'docked') return;

    const onMove = (e: MouseEvent) => {
      if ((e.buttons & 1) === 0) {
        onUp();
        return;
      }
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      if (!dragStartRef.current.started) {
        if (Math.hypot(dx, dy) < DOCK_DRAG_THRESHOLD_PX) return;
        dragStartRef.current.started = true;
        onDragStart?.();
      }
      e.preventDefault();
      setState((s) => ({
        ...s,
        mode: 'dragging',
        x: dragStartRef.current.widgetX + dx,
        y: Math.max(0, dragStartRef.current.widgetY + dy),
      }));
    };

    const onUp = () => {
      if (!dragStartRef.current.started) {
        setState((s) => ({ ...s, mode: 'docked' }));
        return;
      }
      dragStartRef.current.started = false;
      const node = nodeRef.current;
      const parent = node?.offsetParent as HTMLElement;
      const parentWidth = parent?.clientWidth ?? window.innerWidth;
      const widgetWidth = node?.offsetWidth ?? 0;

      setState((s) => {
        const nextDockSide = determineDockSide(
          s.x + widgetWidth / 2,
          parentWidth,
          { allowOutsideLeft },
        );

        if (stateKey) {
          dockStateByKey.set(stateKey, { dockSide: nextDockSide, y: s.y });
        }

        return {
          mode: 'docked',
          dockSide: nextDockSide,
          x: 0,
          y: s.y,
        };
      });
      onDragEnd?.();
    };

    const onCancel = () => {
      const wasDragging = dragStartRef.current.started;
      dragStartRef.current.started = false;
      setState((s) => ({ ...s, mode: 'docked', y: dragStartRef.current.widgetY }));
      if (wasDragging) onDragEnd?.();
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    window.addEventListener('blur', onCancel);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      window.removeEventListener('blur', onCancel);
    };
  }, [allowOutsideLeft, onDragStart, onDragEnd, state.mode, stateKey]);

  // --- Style ---
  const style = useMemo(
    () =>
      state.mode === 'dragging'
        ? getDraggingStyle(state.x, state.y)
        : getDockedStyle(state.dockSide, state.y),
    [state.mode, state.dockSide, state.x, state.y],
  );

  return {
    nodeRef,
    style,
    onMouseDown,
    isDragging: state.mode === 'dragging',
    dockSide: state.dockSide,
  };
};
