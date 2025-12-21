/**
 * Widget Messages
 */

import type { MessageHandlerMap } from '../types';

// Registry
const widgetRegistry = new Map<string, HTMLElement>();
let idCounter = 0;
const generateId = () => `gemigo-${Date.now()}-${++idCounter}`;

export const widgetMessages: MessageHandlerMap = {
  INSERT_WIDGET: (message: { html: string; position?: string | { x: number; y: number }; positionMode?: string }) => {
    try {
      const widgetId = generateId();
      const container = document.createElement('div');
      container.id = widgetId;
      container.className = 'gemigo-widget';
      container.innerHTML = message.html;

      const positionMode = message.positionMode || 'absolute';
      Object.assign(container.style, {
        position: positionMode,
        zIndex: '2147483647',
        pointerEvents: 'auto',
      });

      const pos = message.position;
      if (typeof pos === 'string') {
        container.style.position = 'fixed';
        const positions: Record<string, { top?: string; bottom?: string; left?: string; right?: string }> = {
          'top-left': { top: '16px', left: '16px' },
          'top-right': { top: '16px', right: '16px' },
          'bottom-left': { bottom: '16px', left: '16px' },
          'bottom-right': { bottom: '16px', right: '16px' },
        };
        Object.assign(container.style, positions[pos] || positions['bottom-right']);
      } else if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
        container.style.left = `${pos.x}px`;
        container.style.top = `${pos.y}px`;
      }

      document.body.appendChild(container);
      widgetRegistry.set(widgetId, container);
      return { success: true, widgetId };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  UPDATE_WIDGET: (message: { widgetId: string; html: string }) => {
    try {
      const widget = widgetRegistry.get(message.widgetId);
      if (widget) {
        widget.innerHTML = message.html;
        return { success: true };
      }
      return { success: false, error: 'Widget not found' };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  REMOVE_WIDGET: (message: { widgetId: string }) => {
    try {
      const widget = widgetRegistry.get(message.widgetId);
      if (widget) {
        widget.remove();
        widgetRegistry.delete(message.widgetId);
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },
};
