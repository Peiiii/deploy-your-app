/**
 * Background Service Orchestrator
 * 
 * Encapsulates the entire background process flow: 
 * Lifecycle management, Message Routing, and State.
 */

import { getActiveTab, executeInPage } from './utils/tab';
import type { ContextMenuEvent } from '@gemigo/app-sdk';

/**
 * Methods explicitly implemented in the background script.
 * Combination of HostMethods (RPC) and ChildMethods (Events).
 */
import type { BackgroundHandlers } from './types';

class GemiGoBackgroundController {
    // State
    private pendingContextMenuEvent: ContextMenuEvent | null = null;
    private handlers: BackgroundHandlers = {} as BackgroundHandlers;

    /**
     * Registers message handlers and starts services.
     */
    public provideHandlers = (handlers: Omit<BackgroundHandlers, 'getContextMenuEvent'>) => {
        this.handlers = {
            ...handlers,
            getContextMenuEvent: this.getContextMenuEventImpl,
        } as BackgroundHandlers;
    };

    /**
     * Starts the core background services.
     */
    public start = () => {
        this.initLifecycle();
        this.initRouter();
        console.log('[GemiGo] Service Worker flow initialized via BackgroundService');
    };

    // ========== Handlers Implementation ==========

    private getContextMenuEventImpl = async () => {
        let event = this.pendingContextMenuEvent;
        if (!event) {
            const stored = await chrome.storage.local.get(['pendingContextMenuEvent']);
            event = stored.pendingContextMenuEvent;
        }
        if (event) {
            this.pendingContextMenuEvent = null;
            await chrome.storage.local.remove(['pendingContextMenuEvent']);
            return { success: true, event };
        }
        return { success: true, event: undefined };
    };

    // ========== Lifecycle Layer ==========

    private initLifecycle = () => {
        // 1. Sidebar trigger on icon click
        chrome.action.onClicked.addListener((tab) => {
            if (tab.id) chrome.sidePanel.open({ tabId: tab.id });
        });

        // 2. Initial setup and Context Menu creation
        chrome.runtime.onInstalled.addListener(() => {
            this.setupContextMenus();
        });

        // 3. Context Menu click delegation
        chrome.contextMenus.onClicked.addListener((info, tab) => this.handleContextMenuClick(info, tab));
    };

    private setupContextMenus = () => {
        chrome.contextMenus.removeAll(() => {
            chrome.contextMenus.create({
                id: 'gemigo-translate',
                title: 'Translate with GemiGo',
                contexts: ['selection'],
            });
            chrome.contextMenus.create({
                id: 'gemigo-summarize',
                title: 'Summarize with GemiGo',
                contexts: ['selection', 'page'],
            });
        });
    };

    private handleContextMenuClick = async (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => {
        const event: ContextMenuEvent & { timestamp: number } = {
            menuId: String(info.menuItemId).replace('gemigo-', ''),
            selectionText: info.selectionText,
            pageUrl: info.pageUrl,
            timestamp: Date.now(),
        };

        // Store state
        this.pendingContextMenuEvent = event;
        await chrome.storage.local.set({ pendingContextMenuEvent: event });

        // Ensure sidepanel is open
        if (tab?.id) {
            try {
                await chrome.sidePanel.open({ tabId: tab.id });
            } catch (e) {
                console.error('[GemiGo] Failed to open side panel:', e);
            }
        }

        // Direct push notification
        chrome.runtime.sendMessage({ type: 'onContextMenu', payload: [event] }).catch(() => { });
    };

    // ========== Routing Layer ==========

    private initRouter = () => {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            // Stage 1: Route to Content Script (Transparent Proxy)
            if (message.routing === 'content-script') {
                this.routeToContentScript(message, sendResponse);
                return true;
            }

            // Stage 2: Route to Local Background Handlers
            const handler = (this.handlers as any)[message.type];
            if (handler) {
                this.dispatchToHandler(handler, message, sender, sendResponse);
                return true;
            }

            return false;
        });
    };

    private routeToContentScript = async (message: any, sendResponse: (res: any) => void) => {
        try {
            const tab = await getActiveTab();
            if (!tab?.id) return sendResponse({ success: false, error: 'No active tab' });
            const res = await executeInPage(tab.id, message);
            sendResponse(res);
        } catch (e) {
            sendResponse({ success: false, error: String(e) });
        }
    };

    private dispatchToHandler = async (
        handler: (...args: any[]) => any,
        message: any,
        sender: chrome.runtime.MessageSender,
        sendResponse: (res: any) => void
    ) => {
        try {
            const args = Array.isArray(message.payload) ? message.payload : [];
            const result = handler(...args, sender);

            if (result instanceof Promise) {
                const resolved = await result;
                sendResponse(resolved);
            } else if (result !== undefined) {
                sendResponse(result);
            }
        } catch (e) {
            console.error(`[GemiGo] Handler error [${message.type}]:`, e);
            sendResponse({ success: false, error: String(e) });
        }
    };
}

// Export singleton instance
export const backgroundController = new GemiGoBackgroundController();

