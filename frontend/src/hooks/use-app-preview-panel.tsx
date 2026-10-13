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
    (app: ExploreAppCard, apps: readonly ExploreAppCard[] = [app]) => {
      if (!app.url) return;

      if (!isDesktop) {
        openInNewTab(app.url);
        return;
      }

      // Keep the displayed order stable for this browsing session.
      const seen = new Set<string>();
      const sequence = apps.filter(item => {
        if (!item.url || seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
      if (!seen.has(app.id)) sequence.unshift(app);
      const show = (index: number, switching = false) => {
        const current = sequence[index];
        if (!current) return;
        openRightPanel(
          <AppPreviewPanel
            app={current}
            onClose={closeRightPanel}
            onOpenInNewTab={openInNewTab}
            onPrevious={index > 0 ? () => show(index - 1, true) : undefined}
            onNext={index < sequence.length - 1 ? () => show(index + 1, true) : undefined}
          />,
          { closeOnUnmount: options?.closeOnUnmount ?? false, appId: current.id,
            layout: switching ? useUIStore.getState().rightPanelLayout : 'half' },
        );
      };
      show(sequence.findIndex(item => item.id === app.id));

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
