/**
 * Type-safe wrapper for the GemiGo browser extension SDK.
 * Provides a clean interface for accessing extension capabilities.
 */

export interface GemigoExtensionAPI {
    getPageHTML: () => Promise<string>;
    getSelection: () => Promise<{ text: string; rect?: DOMRect }>;
    highlight: (selector: string, color?: string) => Promise<{ success: boolean; highlightId?: string }>;
    captureVisible: () => Promise<{ success: boolean; dataUrl?: string }>;
}

export interface GemigoNetworkAPI {
    request: (
        url: string,
        options?: {
            method?: string;
            headers?: Record<string, string>;
            body?: unknown;
            responseType?: 'json' | 'text' | 'arraybuffer';
        }
    ) => Promise<unknown>;
}

export interface GemigoSDK {
    extension?: Partial<GemigoExtensionAPI>;
    network?: Partial<GemigoNetworkAPI>;
}

declare global {
    interface Window {
        gemigo?: GemigoSDK;
    }
}

/**
 * Get the GemiGo SDK instance from the window object.
 * Returns undefined if the SDK is not available.
 */
export function getGemigoSDK(): GemigoSDK | undefined {
    return window.gemigo;
}

/**
 * Check if a specific extension method is available.
 */
export function hasExtensionMethod(method: keyof GemigoExtensionAPI): boolean {
    return typeof window.gemigo?.extension?.[method] === 'function';
}

/**
 * Check if the network API is available.
 */
export function hasNetworkAPI(): boolean {
    return typeof window.gemigo?.network?.request === 'function';
}
