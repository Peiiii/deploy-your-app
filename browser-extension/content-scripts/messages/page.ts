/**
 * Page Content Messages
 */

import type { MessageHandlerMap } from '../types';

export const pageMessages: MessageHandlerMap = {
  PING: () => ({ pong: true }),

  GET_PAGE_HTML: () => ({ html: document.documentElement.outerHTML }),

  GET_PAGE_TEXT: () => ({ text: document.body.innerText }),

  GET_SELECTION: () => {
    const selection = window.getSelection();
    const text = selection?.toString() || '';
    let rect = null;

    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const domRect = range.getBoundingClientRect();
      if (domRect.width > 0 && domRect.height > 0) {
        rect = {
          x: domRect.x + window.scrollX,
          y: domRect.y + window.scrollY,
          width: domRect.width,
          height: domRect.height,
        };
      }
    }

    return { text, rect };
  },
};
