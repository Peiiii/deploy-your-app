import { DOCK_OVERLAP_PX, type DockSide } from './types';

// ============================================================================
// PURE UTILITY FUNCTIONS
// ============================================================================
// Extracted from hook to reduce complexity and improve testability

/**
 * Determine which side to dock based on widget center position
 */
export const determineDockSide = (centerX: number, parentWidth: number): DockSide => {
    if (centerX < 0) return 'outside-left';
    if (centerX < parentWidth / 2) return 'inside-left';
    return 'inside-right';
};

/**
 * Calculate CSS style for docked mode
 */
export const getDockedStyle = (dockSide: DockSide, y: number): React.CSSProperties => {
    const isLeft = dockSide !== 'inside-right';
    const transform = dockSide === 'outside-left'
        ? `translateX(calc(-100% + ${DOCK_OVERLAP_PX}px))`
        : dockSide === 'inside-right'
            ? 'translateX(-100%)'
            : 'none';

    return { top: y, left: isLeft ? 0 : '100%', transform };
};

/**
 * Calculate CSS style for dragging mode
 */
export const getDraggingStyle = (x: number, y: number): React.CSSProperties => {
    return { left: x, top: y };
};

/**
 * Get element position relative to its offset parent
 */
export const getRelativePosition = (node: HTMLElement | null): { x: number; y: number } | null => {
    const parent = node?.offsetParent as HTMLElement | null;
    if (!node || !parent) return null;

    const rect = node.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    return { x: rect.left - parentRect.left, y: rect.top - parentRect.top };
};
