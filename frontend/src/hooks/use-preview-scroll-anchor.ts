import { useLayoutEffect, useRef, type RefObject } from 'react';
import { useUIStore } from '@/stores/ui.store';

// The card's hover lift is decorative; anchor its layout position instead.
const getCardTop = (element: HTMLElement) =>
  element.getBoundingClientRect().top - new DOMMatrixReadOnly(getComputedStyle(element).transform).m42;

/** Preserve the visible app through the shell's panel/sidebar reflow. */
export const usePreviewScrollAnchor = (scrollRef: RefObject<HTMLElement | null>) => {
  const pending = useRef<{ element: HTMLElement; top: number } | null>(null);

  useLayoutEffect(() => useUIStore.subscribe((next, previous) => {
    const wasSplit = previous.rightPanelContent !== null && previous.rightPanelLayout === 'half';
    const isSplit = next.rightPanelContent !== null && next.rightPanelLayout === 'half';
    if (wasSplit === isSplit && next.sidebarCollapsed === previous.sidebarCollapsed) return;
    // Opening a preview can also collapse the sidebar in the same React batch.
    if (pending.current) return;

    const container = scrollRef.current;
    if (!container || !window.matchMedia('(min-width: 1024px)').matches) return;
    const bounds = container.getBoundingClientRect();
    const cards = Array.from(container.querySelectorAll<HTMLElement>('[data-preview-app-id]'));
    const visibleCards = cards.filter((card) => {
      const rect = card.getBoundingClientRect();
      return rect.bottom > bounds.top && rect.top < bounds.bottom;
    });
    const openedCard = isSplit && previous.rightPanelContent === null
      ? visibleCards.find((card) => card.dataset.previewAppId === next.rightPanelAppId)
      : undefined;
    const element = openedCard ?? visibleCards[0];
    pending.current = element ? { element, top: getCardTop(element) } : null;
  }), [scrollRef]);

  // Every shell commit can consume the snapshot; unrelated updates never create one.
  useLayoutEffect(() => {
    const anchor = pending.current;
    pending.current = null;
    const container = scrollRef.current;
    if (!anchor || !container?.contains(anchor.element)) return;
    container.scrollTop += getCardTop(anchor.element) - anchor.top;
  });
};
