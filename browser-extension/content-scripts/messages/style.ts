/**
 * Style Messages
 */

import type { MessageHandlerMap } from '../types';

// Registry
const styleRegistry = new Map<string, HTMLStyleElement>();
let idCounter = 0;
const generateId = () => `gemigo-style-${Date.now()}-${++idCounter}`;

export const styleMessages: MessageHandlerMap = {
  INJECT_CSS: (message: { css: string }) => {
    try {
      const styleId = generateId();
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = message.css;
      document.head.appendChild(style);
      styleRegistry.set(styleId, style);
      return { success: true, styleId };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  REMOVE_CSS: (message: { styleId: string }) => {
    try {
      const style = styleRegistry.get(message.styleId);
      if (style) {
        style.remove();
        styleRegistry.delete(message.styleId);
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },
};
