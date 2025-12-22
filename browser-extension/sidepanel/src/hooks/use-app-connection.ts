/**
 * use-app-connection - Semantic bridge between Host and Child App
 *
 * This hook encapsulates the entire Penpal handshake lifecycle, host method injection,
 * and global message registry synchronization.
 */

import { useEffect, useState, useRef } from 'react';
import { connectToChild, Connection } from 'penpal';
import { createHostMethods } from '../host-methods';
import type { AppConfig } from '../types';
import type { ChildMethods } from '@gemigo/app-sdk';

/**
 * Registry to bridge global Chrome events to the current active app.
 * This pattern decouples message listeners from the React component lifecycle.
 */
export const AppBridgeRegistry = {
    activeChild: null as ChildMethods | null,

    register(child: ChildMethods) {
        this.activeChild = child;
    },

    unregister() {
        this.activeChild = null;
    },

    get() {
        return this.activeChild;
    },

    /**
     * Dispatches incoming Chrome messages directly to the SDK event handlers.
     *
     * By standardizing the Chrome message structure:
     * 1. message.type matches the ChildMethods method name (e.g., 'onContextMenu')
     * 2. message.payload is an array of arguments for that method
     *
     * This allows for a zero-logic, zero-redundancy dispatcher.
     */
    dispatch(message: { type: string; payload?: unknown[] }) {
        const child = this.get();
        if (!child) return;

        // Direct invocation: The type IS the method name, the payload IS the arguments.
        const methodName = message.type as keyof ChildMethods;
        const args = Array.isArray(message.payload) ? message.payload : [];

        if (typeof child[methodName] === 'function') {
            (child[methodName] as any)(...args);
        }
    },
};

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

/**
 * Custom hook to manage the Penpal bridge between the Extension Host and the Child App.
 *
 * It handles the full handshake lifecycle:
 * 1. Injecting Host Methods into the iframe.
 * 2. Establishing the Penpal JSON-RPC bridge.
 * 3. Syncing the global `AppBridgeRegistry` for event forwarding.
 * 4. Cleaning up resources and destroying the bridge on unmount.
 *
 * @param iframeRef - A React ref pointing to the <iframe> element.
 * @param app - The configuration of the app being loaded.
 * @returns An object containing the current connection status and helper flags.
 *
 * @example
 * const { isConnected, hasError } = useAppConnection(iframeRef, app);
 */
export function useAppConnection(iframeRef: React.RefObject<HTMLIFrameElement>, app: AppConfig) {
    const [status, setStatus] = useState<ConnectionStatus>('idle');
    const connectionRef = useRef<Connection<object> | null>(null);

    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe) return;

        // --- Phase 1: Preparation ---
        const prepareHostMethods = () => createHostMethods(app);

        // --- Phase 2: Handshake ---
        const establishHandshake = (methods: object) => {
            setStatus('connecting');

            const connection = connectToChild({
                iframe,
                methods: methods as Record<string, (...args: unknown[]) => unknown>,
            });

            connectionRef.current = connection;
            return connection;
        };

        // --- Phase 3: Lifecycle Management ---
        const methods = prepareHostMethods();
        const connection = establishHandshake(methods);

        connection.promise
            .then((childMethods) => {
                console.log(`[GemiGo] Bridge established with: ${app.name}`);
                AppBridgeRegistry.register(childMethods as ChildMethods);
                setStatus('connected');
            })
            .catch((error) => {
                console.error(`[GemiGo] Bridge failed:`, error);
                setStatus('error');
            });

        // --- Phase 4: Teardown ---
        return () => {
            console.log(`[GemiGo] Cleaning up bridge: ${app.name}`);
            AppBridgeRegistry.unregister();
            connection.destroy();
            setStatus('idle');
        };
    }, [iframeRef, app]);

    return {
        status,
        isConnected: status === 'connected',
        isConnecting: status === 'connecting',
        hasError: status === 'error',
    };
}
