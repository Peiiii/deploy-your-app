/**
 * Highlight Messages
 */

import type { MessageHandlerMap } from '../types';

// Registry
const highlightRegistry = new Map<string, HTMLElement[]>();
let idCounter = 0;
const generateId = () => `gemigo-highlight-${Date.now()}-${++idCounter}`;

export const highlightMessages: MessageHandlerMap = {
  HIGHLIGHT_ELEMENT: (message: { selector: string; color?: string }) => {
    try {
      const highlightId = generateId();
      const elements = document.querySelectorAll(message.selector);
      const highlighted: HTMLElement[] = [];

      elements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        htmlEl.dataset.gemigoOriginalBg = htmlEl.style.backgroundColor;
        htmlEl.style.backgroundColor = message.color || '#fef08a';
        htmlEl.style.transition = 'background-color 0.3s';
        highlighted.push(htmlEl);
      });

      highlightRegistry.set(highlightId, highlighted);
      return { success: true, count: elements.length, highlightId };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  REMOVE_HIGHLIGHT: (message: { highlightId: string }) => {
    try {
      const elements = highlightRegistry.get(message.highlightId);
      if (elements) {
        elements.forEach((el) => {
          el.style.backgroundColor = el.dataset.gemigoOriginalBg || '';
          delete el.dataset.gemigoOriginalBg;
        });
        highlightRegistry.delete(message.highlightId);
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },
};
