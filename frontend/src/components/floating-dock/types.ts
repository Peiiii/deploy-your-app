// ============================================================================
// TYPES AND CONSTANTS FOR FLOATING DOCK
// ============================================================================

/** Overlap in pixels for seamless edge merging when docked outside */
export const DOCK_OVERLAP_PX = 1;

/** Separate a click (including small pointer jitter) from a drag. */
export const DOCK_DRAG_THRESHOLD_PX = 5;

/** Default widget height fallback for boundary calculations */
export const DEFAULT_WIDGET_HEIGHT = 100;

/** Possible docking positions */
export type DockSide = 'outside-left' | 'inside-left' | 'inside-right';

/** Pending presses keep docking until movement establishes a drag. */
export type DockMode = 'docked' | 'pending' | 'dragging';

/** Drag session data stored in ref to avoid stale closures */
export interface DragSession {
  startMouseX: number;
  startMouseY: number;
  initialWidgetX: number;
  initialWidgetY: number;
  currentX: number;
  currentY: number;
}

/** Initial position configuration */
export interface InitialPosition {
  y: number;
  dockSide: DockSide;
}

export const DEFAULT_INITIAL_POSITION: InitialPosition = {
  y: 0,
  dockSide: 'outside-left',
};
