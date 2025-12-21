/**
 * Event Bus
 * 
 * Centralized event registration and dispatch system.
 */

import type { ContextMenuEvent } from '../types';

/** Selection change event */
/** Selection change event */
export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Event handler type map */
export interface EventHandlerMap {
  contextMenu: (event: ContextMenuEvent) => void;
  selectionChange: (text: string, rect: SelectionRect | null, url?: string) => void;
}

/** Event names */
export type EventName = keyof EventHandlerMap;

/** Event handlers storage */
const handlers: {
  [K in EventName]: EventHandlerMap[K][];
} = {
  contextMenu: [],
  selectionChange: [],
};

/**
 * Register an event handler
 * 
 * @param event - Event name
 * @param handler - Handler function
 * @returns Unsubscribe function
 */
export function on<K extends EventName>(
  event: K,
  handler: EventHandlerMap[K]
): () => void {
  handlers[event].push(handler);
  
  return () => {
    const index = handlers[event].indexOf(handler);
    if (index > -1) {
      handlers[event].splice(index, 1);
    }
  };
}

/**
 * Emit an event to all registered handlers
 * 
 * @param event - Event name
 * @param data - Event data
 */
export function emit<K extends EventName>(
  event: K,
  data: Parameters<EventHandlerMap[K]>[0]
): void {
  handlers[event].forEach((handler) => {
    try {
      (handler as (data: unknown) => void)(data);
    } catch (err) {
      console.error(`[GemiGo SDK] Error in ${event} handler:`, err);
    }
  });
}

/**
 * Get child methods that connect events to the bus
 */
export function getChildMethods() {
  return {
    onContextMenuEvent(event: ContextMenuEvent) {
      emit('contextMenu', event);
    },
    onSelectionChange(text: string, rect: SelectionRect | null, url?: string) {
      handlers.selectionChange.forEach((handler) => {
        try {
          handler(text, rect, url);
        } catch (err) {
          console.error('[GemiGo SDK] Error in selectionChange handler:', err);
        }
      });
    },
  };
}

