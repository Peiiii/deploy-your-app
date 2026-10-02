import { useCallback } from 'react';
import type { ExploreAppCard } from '@/components/explore-app-card';
import { AppPreviewPanel } from '@/features/home/components/app-preview-panel';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { useRightPanel } from '@/hooks/use-right-panel';
import { useUIStore } from '@/stores/ui.store';

interface UseAppPreviewPanelOptions {
  /**
   * When opening on desktop, collapse the left sidebar to give the preview more room.
   * @default true
   */
  collapseSidebar?: boolean;
  /**
   * If true, the right panel will automatically close when the component that
   * opened it unmounts (e.g. route change). For app preview, we default to
   * keeping it open until the user manually closes it.
   * @default false
   */
  closeOnUnmount?: boolean;
}

export const useAppPreviewPanel = (options?: UseAppPreviewPanelOptions) => {
  const { isDesktop } = useBreakpoint();
  const { openRightPanel, closeRightPanel, isOpen: isPanelOpen } = useRightPanel();

  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useUIStore((s) => s.actions.setSidebarCollapsed);

  const openInNewTab = useCallback((url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  const openAppPreview = useCallback(
    (app: ExploreAppCard) => {
      if (!app.url) return;

      if (!isDesktop) {
        openInNewTab(app.url);
        return;
      }

      openRightPanel(
        <AppPreviewPanel
          app={app}
          onClose={closeRightPanel}
          onOpenInNewTab={openInNewTab}
        />,
        { closeOnUnmount: options?.closeOnUnmount ?? false },
      );

      const shouldCollapse = options?.collapseSidebar ?? true;
      if (shouldCollapse && !sidebarCollapsed) {
        setSidebarCollapsed(true);
      }
    },
    [
      closeRightPanel,
      isDesktop,
      openInNewTab,
      openRightPanel,
      options?.collapseSidebar,
      options?.closeOnUnmount,
      setSidebarCollapsed,
      sidebarCollapsed,
    ],
  );

  return {
    openAppPreview,
    closeRightPanel,
    isPanelOpen,
  };
};
