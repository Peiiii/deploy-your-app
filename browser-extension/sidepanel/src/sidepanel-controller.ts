import type { HostMethods } from '@gemigo/app-sdk';
import { BaseExtensionController } from '../../core/base-controller';
import { AppBridgeRegistry } from './hooks/use-app-connection';
import type { AppConfig, SidepanelEvents, SidepanelHandlers } from './types';
import { hasPermission } from './utils/permissions';
import { ok } from './utils/response';

type LocalSidepanelHandlers = {
    [K in keyof SidepanelHandlers]: (app: AppConfig, ...args: Parameters<SidepanelHandlers[K]>) => ReturnType<SidepanelHandlers[K]>;
};

type BridgeImplHandlers = {
    onContextMenu: (event: any) => void;
    onSelectionChange: (...args: any[]) => void;
};

type InternalHandlers = LocalSidepanelHandlers & BridgeImplHandlers;

export class GemiGoSidepanelController extends BaseExtensionController<InternalHandlers, SidepanelEvents> {

    /**
     * Initializes the controller and starts listening for extension events.
     */
    public start = () => {
        // Register local implementation handlers
        this.registerLocalHandlers();

        // Start listening for extension bus messages
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            // We only route messages that match our Bridge handlers
            // Storage/Protocol requests come via Penpal, not this listener.
            if (['onContextMenu', 'onSelectionChange'].includes(message.type)) {
                return this.handleMessage(message, sender, sendResponse);
            }
        });
    };

    /**
     * Executes a local handler if it exists.
     * This is used by the HostRouter to satisfy Penpal requests.
     */
    public executeLocalHandler = async (method: keyof HostMethods, app: AppConfig, args: any[]) => {
        const handler = (this.handlers as any)[method];
        if (handler) {
            return handler(app, ...args);
        }
        return undefined;
    };

    private registerLocalHandlers = () => {
        const localHandlers: LocalSidepanelHandlers = {
            getProtocolInfo: this.getProtocolInfo,
            storageGet: this.storageGet,
            storageSet: this.storageSet,
            storageDelete: this.storageDelete,
            storageClear: this.storageClear,
        };

        const bridgeHandlers: BridgeImplHandlers = {
            onContextMenu: (event: any) => AppBridgeRegistry.dispatch({ type: 'onContextMenu', payload: [event] }),
            onSelectionChange: (...args: any[]) => AppBridgeRegistry.dispatch({ type: 'onSelectionChange', payload: args }),
        };

        // Initialize handlers logic
        this.handlers = {
            ...this.handlers,
            ...localHandlers,
            ...bridgeHandlers
        } as unknown as InternalHandlers;
    };

    // ========== Local Implementations ==========

    private getProtocolInfo = async (app: AppConfig) => {
        return {
            protocolVersion: 1,
            platform: 'extension' as const,
            appId: app.id,
            capabilities: {
                storage: true,
                notification: true,
                network: hasPermission(app, 'network') && (app.networkAllowlist?.length ?? 0) > 0,
                // These are desktop-specific or not supported in extension yet
                scheduler: false,
                fileWatch: false,
                fileWrite: false, // Could be true if we support file API shim?
                clipboard: true,  // Extensions usually have clipboard access
                ai: false,        // Unless we proxy AI?
                shell: false,
                extension: {
                    read: true,
                    events: true,
                    modify: hasPermission(app, 'extension.modify'),
                    capture: hasPermission(app, 'extension.capture'),
                },
            },

        };
    };

    private storageGet = async (app: AppConfig, key: string) =>
        chrome.storage.local
            .get([`app:${app.id}:${key}`])
            .then((s) => ({ success: true, data: s[`app:${app.id}:${key}`] }));

    private storageSet = async (app: AppConfig, key: string, value: unknown) =>
        chrome.storage.local.set({ [`app:${app.id}:${key}`]: value }).then(() => ok());

    private storageDelete = async (app: AppConfig, key: string) =>
        chrome.storage.local.remove([`app:${app.id}:${key}`]).then(() => ok());

    private storageClear = async (app: AppConfig) => {
        const all = await chrome.storage.local.get(null);
        const keys = Object.keys(all).filter((k) => k.startsWith(`app:${app.id}:`));
        if (keys.length > 0) await chrome.storage.local.remove(keys);
        return ok();
    };

}

export const sidepanelController = new GemiGoSidepanelController();
