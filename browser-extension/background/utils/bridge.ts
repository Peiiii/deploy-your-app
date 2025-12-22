/**
 * Bridge Utilities
 * 
 * Provides tools to generate transparent message proxies.
 */

import type { ChildMethods } from '@gemigo/app-sdk';

/**
 * Creates a handler object that transparently forwards specified events to the sidepanel.
 */
export const createTransparentHandlers = <K extends keyof ChildMethods>(
    events: K[]
): Pick<ChildMethods, K> => {
    const handlers: any = {};

    events.forEach((event) => {
        handlers[event] = (...args: any[]) => {
            chrome.runtime.sendMessage({
                type: event,
                payload: args,
            }).catch(() => { });
        };
    });

    return handlers;
};
