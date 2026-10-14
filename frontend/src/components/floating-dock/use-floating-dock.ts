import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { useMemoizedFn } from 'ahooks';
import {
  DEFAULT_INITIAL_POSITION,
  DOCK_DRAG_THRESHOLD_PX,
  type DockSide,
  type DockMode,
  type InitialPosition,
} from './types';
import { determineDockSide, getDockedStyle, getDraggingStyle, getRelativePosition } from './utils';

// ============================================================================
// FLOATING DOCK HOOK
// ============================================================================
// Pending clicks keep CSS docking; established drags use pixel positioning.
// ============================================================================

type PersistedDockState = { dockSide: DockSide; y: number };
const dockStateByKey = new Map<string, PersistedDockState>();

export interface UseFloatingDockOptions {
  nodeRef?: React.RefObject<HTMLDivElement | null>;
  /** Only the initial position follows the bottom edge; established drags use pixel positions. */
  initialAnchor?: 'top' | 'bottom';
  topInset?: number;
  /** Reserve a bottom band for other floating controls. */
  bottomInset?: number;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
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
  onPointerDown: (e: React.PointerEvent) => void;
  isDragging: boolean;
  dockSide: DockSide;
}

export const useFloatingDock = (options: UseFloatingDockOptions = {}): UseFloatingDockReturn => {
  const {
    onInteractionStart,
    onInteractionEnd,
    initialPosition = DEFAULT_INITIAL_POSITION,
    allowOutsideLeft = true,
    stateKey,
    bottomInset,
    topInset = 0,
    initialAnchor = 'top',
  } = options;

  const [state, setState] = useState(() => {
    const persisted = stateKey ? dockStateByKey.get(stateKey) : undefined;
    return {
      mode: 'docked' as DockMode,
      anchored: !persisted && initialAnchor === 'bottom',
      dockSide: persisted?.dockSide ?? initialPosition.dockSide,
      x: 0,
      y: persisted?.y ?? initialPosition.y,
    };
  });

  const internalNodeRef = useRef<HTMLDivElement>(null);
  const nodeRef = options.nodeRef ?? internalNodeRef;
  const [bounds, setBounds] = useState({ parentHeight: 0, widgetHeight: 0 });
  useLayoutEffect(() => {
    const node = nodeRef.current;
    const parent = node?.offsetParent;
    if (!node || !(parent instanceof HTMLElement)) return;
    const measure = () =>
      setBounds((previous) => {
        const next = {
          parentHeight: parent.clientHeight,
          widgetHeight:
            node.firstElementChild instanceof HTMLElement
              ? node.firstElementChild.offsetHeight
              : node.offsetHeight,
        };
        return previous.parentHeight === next.parentHeight &&
          previous.widgetHeight === next.widgetHeight
          ? previous
          : next;
      });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    observer.observe(node);
    if (node.firstElementChild) observer.observe(node.firstElementChild);
    return () => observer.disconnect();
  }, [nodeRef]);

  const dragStartRef = useRef({
    mouseX: 0,
    mouseY: 0,
    widgetX: 0,
    widgetY: 0,
    started: false,
    wasAnchored: false,
    pointerId: 0,
  });

  // If the caller disallows "outside-left" (e.g. fullscreen), ensure the dock
  // is always visible even if it was previously parked outside the viewport.
  useEffect(() => {
    if (allowOutsideLeft) return;
    queueMicrotask(() => {
      setState((s) => {
        if (s.mode !== 'docked') return s;
        if (s.dockSide !== 'outside-left') return s;

        const nextDockSide: DockSide =
          initialPosition.dockSide === 'outside-left' ? 'inside-left' : initialPosition.dockSide;

        return {
          ...s,
          dockSide: nextDockSide,
          y: initialPosition.y,
        };
      });
    });
  }, [allowOutsideLeft, initialPosition.dockSide, initialPosition.y]);

  // --- Start Dragging ---
  const onPointerDown = useMemoizedFn((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const pos = getRelativePosition(nodeRef.current);
    if (!pos) return;

    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      widgetX: pos.x,
      widgetY: pos.y,
      started: false,
      wasAnchored: state.anchored,
      pointerId: e.pointerId,
    };
    onInteractionStart?.();
    setState((s) => ({ ...s, mode: 'pending' }));
  });

  // --- Dragging & Drop ---
  useEffect(() => {
    if (state.mode === 'docked') return;

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== dragStartRef.current.pointerId) return;
      if ((e.buttons & 1) === 0) {
        onUp();
        return;
      }
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      if (!dragStartRef.current.started) {
        if (Math.hypot(dx, dy) < DOCK_DRAG_THRESHOLD_PX) return;
        dragStartRef.current.started = true;
      }
      e.preventDefault();
      setState((s) => ({
        ...s,
        mode: 'dragging',
        anchored: false,
        x: dragStartRef.current.widgetX + dx,
        y: Math.max(0, dragStartRef.current.widgetY + dy),
      }));
    };

    const onUp = (event?: PointerEvent) => {
      if (event && event.pointerId !== dragStartRef.current.pointerId) return;
      if (!dragStartRef.current.started) {
        setState((s) => ({ ...s, mode: 'docked' }));
        onInteractionEnd?.();
        return;
      }
      dragStartRef.current.started = false;
      const node = nodeRef.current;
      const parent = node?.offsetParent as HTMLElement;
      const parentWidth = parent?.clientWidth ?? window.innerWidth;
      const widgetWidth = node?.offsetWidth ?? 0;

      const settledY = getRelativePosition(node)?.y ?? 0;
      setState((s) => {
        const nextDockSide = determineDockSide(s.x + widgetWidth / 2, parentWidth, {
          allowOutsideLeft,
        });

        if (stateKey) {
          dockStateByKey.set(stateKey, { dockSide: nextDockSide, y: settledY });
        }

        return {
          mode: 'docked',
          anchored: false,
          dockSide: nextDockSide,
          x: 0,
          y: settledY,
        };
      });
      onInteractionEnd?.();
    };

    const onCancel = (event?: Event) => {
      if (event instanceof PointerEvent && event.pointerId !== dragStartRef.current.pointerId)
        return;
      dragStartRef.current.started = false;
      setState((s) => ({
        ...s,
        mode: 'docked',
        anchored: dragStartRef.current.wasAnchored,
        y: dragStartRef.current.widgetY,
      }));
      onInteractionEnd?.();
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    window.addEventListener('blur', onCancel);
    document.addEventListener('pointercancel', onCancel);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      window.removeEventListener('blur', onCancel);
      document.removeEventListener('pointercancel', onCancel);
    };
  }, [allowOutsideLeft, onInteractionStart, onInteractionEnd, state.mode, stateKey, nodeRef]);

  // --- Style ---
  const style = useMemo(() => {
    const availableHeight = Math.max(0, bounds.parentHeight - (bottomInset ?? 0));
    const maxY = Math.max(0, availableHeight - bounds.widgetHeight);
    const minY = Math.min(topInset, maxY);
    const preferredY = state.anchored
      ? bounds.parentHeight - initialPosition.y - bounds.widgetHeight
      : state.y;
    const y = Math.max(minY, Math.min(preferredY, maxY));
    const position =
      state.mode === 'dragging' ? getDraggingStyle(state.x, y) : getDockedStyle(state.dockSide, y);
    return {
      ...position,
      maxHeight: Math.max(0, availableHeight - y),
      overflowY: 'auto' as const,
      scrollbarWidth: 'none' as const,
    };
  }, [
    state.mode,
    state.dockSide,
    state.x,
    state.y,
    state.anchored,
    initialPosition.y,
    bottomInset,
    topInset,
    bounds,
  ]);

  return {
    nodeRef,
    style,
    onPointerDown,
    isDragging: state.mode === 'dragging',
    dockSide: state.dockSide,
  };
};
