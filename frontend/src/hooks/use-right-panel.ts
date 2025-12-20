import { useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useUIStore } from '@/stores/ui.store';

export interface OpenRightPanelOptions {
  /**
   * If true, the panel will automatically close when the component that opened it unmounts.
   * @default true
   */
  closeOnUnmount?: boolean;
}

/**
 * Global right panel service hook.
 * Allows any component to open/close a right-side panel with arbitrary content.
 *
 * @example
 * ```tsx
 * const { openRightPanel, closeRightPanel, isOpen } = useRightPanel();
 *
 * const handleClick = () => {
 *   openRightPanel(
 *     <MyPanelContent onClose={closeRightPanel} />,
 *     { closeOnUnmount: true }
 *   );
 * };
 * ```
 */
export const useRightPanel = () => {
  const rightPanelId = useUIStore((s) => s.rightPanelId);
  const openRightPanelAction = useUIStore((s) => s.actions.openRightPanel);
  const closeRightPanelAction = useUIStore((s) => s.actions.closeRightPanel);

  // Track the panel ID that THIS hook instance opened
  const ownPanelIdRef = useRef<string | null>(null);
  // Track whether to close on unmount
  const closeOnUnmountRef = useRef(true);

  const openRightPanel = useCallback(
    (content: ReactNode, options?: OpenRightPanelOptions) => {
      const id = `panel-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      ownPanelIdRef.current = id;
      closeOnUnmountRef.current = options?.closeOnUnmount ?? true;
      openRightPanelAction(content, id);
    },
    [openRightPanelAction]
  );

  const closeRightPanel = useCallback(() => {
    if (ownPanelIdRef.current) {
      closeRightPanelAction(ownPanelIdRef.current);
      ownPanelIdRef.current = null;
    }
  }, [closeRightPanelAction]);

  // Auto-close on unmount if configured
  useEffect(() => {
    return () => {
      if (closeOnUnmountRef.current && ownPanelIdRef.current) {
        closeRightPanelAction(ownPanelIdRef.current);
      }
    };
  }, [closeRightPanelAction]);

  return {
    /** Whether any right panel is currently open */
    isOpen: rightPanelId !== null,
    /** Open a right panel with the given content */
    openRightPanel,
    /** Close the panel that was opened by this hook instance */
    closeRightPanel,
  };
};
