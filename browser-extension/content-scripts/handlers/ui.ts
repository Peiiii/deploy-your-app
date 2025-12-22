/**
 * Page UI Manipulation Handlers
 */

import type { CSSResult, HighlightResult, WidgetPosition, WidgetResult } from '@gemigo/app-sdk';

const widgetRegistry = new Map<string, HTMLElement>();
const styleRegistry = new Map<string, HTMLStyleElement>();
const highlightRegistry = new Map<string, HTMLElement[]>();
let idCounter = 0;
const generateId = () => `gemigo-${Date.now()}-${++idCounter}`;

import type { UiHandlers } from '../types';

export const uiHandlers: UiHandlers = {
    highlight: async (selector: string, color?: string): Promise<HighlightResult> => {
        try {
            const highlightId = generateId();
            const elements = document.querySelectorAll(selector);
            const highlighted: HTMLElement[] = [];
            elements.forEach((el) => {
                const htmlEl = el as HTMLElement;
                htmlEl.dataset.gemigoOriginalBg = htmlEl.style.backgroundColor;
                htmlEl.style.backgroundColor = color || '#fef08a';
                htmlEl.style.transition = 'background-color 0.3s';
                highlighted.push(htmlEl);
            });
            highlightRegistry.set(highlightId, highlighted);
            return { success: true, count: elements.length, highlightId };
        } catch (e) {
            return { success: false, error: String(e) };
        }
    },

    removeHighlight: async (highlightId: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const elements = highlightRegistry.get(highlightId);
            if (elements) {
                elements.forEach((el) => {
                    el.style.backgroundColor = el.dataset.gemigoOriginalBg || '';
                    delete el.dataset.gemigoOriginalBg;
                });
                highlightRegistry.delete(highlightId);
            }
            return { success: true };
        } catch (e) {
            return { success: false, error: String(e) };
        }
    },

    insertWidget: async (html: string, position?: string | WidgetPosition): Promise<WidgetResult> => {
        try {
            const widgetId = generateId();
            const container = document.createElement('div');
            container.id = widgetId;
            container.className = 'gemigo-widget';
            container.innerHTML = html;
            Object.assign(container.style, {
                position: 'absolute',
                zIndex: '2147483647',
                pointerEvents: 'auto',
            });

            if (typeof position === 'string') {
                container.style.position = 'fixed';
                const positions: Record<string, { top?: string; bottom?: string; left?: string; right?: string }> = {
                    'top-left': { top: '16px', left: '16px' },
                    'top-right': { top: '16px', right: '16px' },
                    'bottom-left': { bottom: '16px', left: '16px' },
                    'bottom-right': { bottom: '16px', right: '16px' },
                };
                Object.assign(container.style, positions[position] || positions['bottom-right']);
            } else if (position && typeof position.x === 'number') {
                container.style.left = `${position.x}px`;
                container.style.top = `${position.y}px`;
            }

            document.body.appendChild(container);
            widgetRegistry.set(widgetId, container);
            return { success: true, widgetId };
        } catch (e) {
            return { success: false, error: String(e) };
        }
    },

    updateWidget: async (widgetId: string, html: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const widget = widgetRegistry.get(widgetId);
            if (widget) {
                widget.innerHTML = html;
                return { success: true };
            }
            return { success: false, error: 'Widget not found' };
        } catch (e) {
            return { success: false, error: String(e) };
        }
    },

    removeWidget: async (widgetId: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const widget = widgetRegistry.get(widgetId);
            if (widget) {
                widget.remove();
                widgetRegistry.delete(widgetId);
            }
            return { success: true };
        } catch (e) {
            return { success: false, error: String(e) };
        }
    },

    injectCSS: async (css: string): Promise<CSSResult> => {
        try {
            const styleId = generateId();
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = css;
            document.head.appendChild(style);
            styleRegistry.set(styleId, style);
            return { success: true, styleId };
        } catch (e) {
            return { success: false, error: String(e) };
        }
    },

    removeCSS: async (styleId: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const style = styleRegistry.get(styleId);
            if (style) {
                style.remove();
                styleRegistry.delete(styleId);
            }
            return { success: true };
        } catch (e) {
            return { success: false, error: String(e) };
        }
    },
};
