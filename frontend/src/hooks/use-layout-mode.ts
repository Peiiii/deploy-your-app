import { useUIStore } from '@/stores/ui.store';
import { useBreakpoint } from './use-breakpoint';

export interface LayoutModeState {
    /** Viewport is below md breakpoint (typically < 768px) */
    isMobile: boolean;
    /** Viewport is desktop but right panel is open in 'half' mode, squeezing content */
    isSqueezed: boolean;
    /** Either mobile or squeezed - components should use this for compact layout switching */
    isCompact: boolean;
    /** Current breakpoint name (sm, md, lg, xl, 2xl) */
    breakpoint: string | null;
}

/**
 * Hook to detect and respond to "squeezed" layout states.
 * Centralizes logic for adaptive UI when the right application panel is open.
 */
export const useLayoutMode = (): LayoutModeState => {
    const { isMobile, current: breakpoint } = useBreakpoint();
    const hasRightPanel = useUIStore((s) => s.rightPanelContent !== null);
    const rightPanelLayout = useUIStore((s) => s.rightPanelLayout);

    // Squeezed means we are on a larger screen (where right panel can be open side-by-side)
    // but the panel IS open, taking up 50% of the space.
    const isSqueezed = !isMobile && hasRightPanel && rightPanelLayout === 'half';

    return {
        isMobile,
        isSqueezed,
        isCompact: isMobile || isSqueezed,
        breakpoint,
    };
};
