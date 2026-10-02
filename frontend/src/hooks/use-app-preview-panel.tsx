import { useCallback } from 'react';
import type { ExploreAppCard } from '@/components/explore-app-card';
import { AppPreviewPanel } from '@/features/home/components/app-preview-panel';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { useRightPanel } from '@/hooks/use-right-panel';

interface UseAppPreviewPanelOptions {
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


    },
    [
      closeRightPanel,
      isDesktop,
      openInNewTab,
      openRightPanel,
      options?.closeOnUnmount,
    ],
  );

  return {
    openAppPreview,
    closeRightPanel,
    isPanelOpen,
  };
};
