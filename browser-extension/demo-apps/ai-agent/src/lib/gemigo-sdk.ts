/**
 * GemiGo Browser Extension SDK - Complete Type Definitions
 * 
 * This module provides complete type-safe interface for the GemiGo browser
 * extension SDK, covering all available APIs.
 */

// ============================================================================
// Extension API Types
// ============================================================================

/** Page information result */
export interface PageInfo {
    url: string;
    title: string;
    favicon?: string;
}

/** Selection result from getSelection() */
export interface SelectionResult {
    text: string;
    rect?: DOMRect;
}

/** Highlight result */
export interface HighlightResult {
    success: boolean;
    highlightId?: string;
    count?: number;
}

/** Screenshot capture result */
export interface CaptureResult {
    success: boolean;
    dataUrl?: string;
}

/** Article extraction result */
export interface ArticleResult {
    success: boolean;
    title?: string;
    excerpt?: string;
    content?: string;
    byline?: string;
    siteName?: string;
}

/** Link extraction result */
export interface LinkInfo {
    href: string;
    text: string;
}

export interface ExtractLinksResult {
    success: boolean;
    links?: LinkInfo[];
}

/** Image extraction result */
export interface ImageInfo {
    src: string;
    alt?: string;
    width?: number;
    height?: number;
}

export interface ExtractImagesResult {
    success: boolean;
    images?: ImageInfo[];
}

/** Query element result */
export interface QueryElementResult {
    success: boolean;
    elements?: Array<{
        tag: string;
        text?: string;
        attributes?: Record<string, string>;
    }>;
}

/** Widget insertion result */
export interface InsertWidgetResult {
    success: boolean;
    widgetId?: string;
}

/** CSS injection result */
export interface InjectCSSResult {
    success: boolean;
    styleId?: string;
}

/** Context menu event */
export interface ContextMenuEvent {
    type: 'text' | 'link' | 'image' | 'page';
    selection?: string;
    linkUrl?: string;
    srcUrl?: string;
    pageUrl: string;
}

export interface ContextMenuEventResult {
    success: boolean;
    event?: ContextMenuEvent;
}

/** Widget position options */
export type WidgetPosition =
    | 'top-left' | 'top-right' | 'top-center'
    | 'bottom-left' | 'bottom-right' | 'bottom-center'
    | 'center';

// ============================================================================
// Extension API Interface
// ============================================================================

export interface GemigoExtensionAPI {
    // --- Page Information ---
    /** Get current page info (URL, title, favicon) */
    getPageInfo(): Promise<PageInfo>;

    /** Get the full HTML content of the current page */
    getPageHTML(): Promise<string>;

    /** Get the currently selected text on the page */
    getSelection(): Promise<SelectionResult>;

    // --- Visual Modification ---
    /** Highlight elements matching a CSS selector */
    highlight(selector: string, color?: string): Promise<HighlightResult>;

    /** Remove a highlight by ID */
    removeHighlight?(highlightId: string): Promise<{ success: boolean }>;

    /** Insert a floating widget on the page */
    insertWidget(html: string, position?: WidgetPosition): Promise<InsertWidgetResult>;

    /** Remove a widget by ID */
    removeWidget(widgetId: string): Promise<{ success: boolean }>;

    /** Inject custom CSS into the page */
    injectCSS(css: string): Promise<InjectCSSResult>;

    /** Remove injected CSS by ID */
    removeCSS(styleId: string): Promise<{ success: boolean }>;

    // --- Content Extraction ---
    /** Capture a screenshot of the visible viewport */
    captureVisible(): Promise<CaptureResult>;

    /** Extract article content using Readability */
    extractArticle(): Promise<ArticleResult>;

    /** Extract all links from the page */
    extractLinks(): Promise<ExtractLinksResult>;

    /** Extract all images from the page */
    extractImages(): Promise<ExtractImagesResult>;

    /** Query elements matching a CSS selector */
    queryElement(selector: string, limit?: number): Promise<QueryElementResult>;

    // --- Context Menu ---
    /** Get pending context menu event (if app was opened from context menu) */
    getContextMenuEvent(): Promise<ContextMenuEventResult>;

    /** Subscribe to context menu events */
    onContextMenu(callback: (event: ContextMenuEvent) => void): () => void;

    // --- Selection Events ---
    /** Subscribe to selection change events */
    onSelectionChange(
        callback: (text: string, rect: DOMRect | null, url: string) => void
    ): () => void;
}

// ============================================================================
// Network API Types
// ============================================================================

export interface NetworkRequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
    headers?: Record<string, string>;
    body?: unknown;
    responseType?: 'json' | 'text' | 'arraybuffer' | 'blob';
    timeout?: number;
}

export interface NetworkResponse<T = unknown> {
    success: boolean;
    status?: number;
    statusText?: string;
    headers?: Record<string, string>;
    data?: T;
    error?: string;
}

export interface GemigoNetworkAPI {
    /**
     * Make an HTTP request from the extension background (CORS-free).
     * 
     * @example
     * ```ts
     * const result = await gemigo.network.request('https://api.example.com/data', {
     *   method: 'POST',
     *   headers: { 'Content-Type': 'application/json' },
     *   body: { foo: 'bar' },
     *   responseType: 'json',
     * });
     * ```
     */
    request<T = unknown>(url: string, options?: NetworkRequestOptions): Promise<NetworkResponse<T>>;
}

// ============================================================================
// Storage API Types
// ============================================================================

export interface GemigoStorageAPI {
    /** Get a value from extension storage */
    get<T = unknown>(key: string): Promise<T | undefined>;

    /** Set a value in extension storage */
    set<T = unknown>(key: string, value: T): Promise<void>;

    /** Remove a value from extension storage */
    remove(key: string): Promise<void>;

    /** Clear all extension storage */
    clear(): Promise<void>;

    /** Get all keys in storage */
    keys?(): Promise<string[]>;
}

// ============================================================================
// Common API Types
// ============================================================================

export interface NotifyOptions {
    title: string;
    body: string;
    icon?: string;
}

export interface NotifyResult {
    success: boolean;
}

// ============================================================================
// Full SDK Interface
// ============================================================================

export interface GemigoSDK {
    /** Platform identifier */
    platform?: string;

    /** Available capabilities */
    capabilities?: string[];

    /** Page interaction APIs */
    extension: Partial<GemigoExtensionAPI>;

    /** Network request APIs (CORS-free) */
    network: Partial<GemigoNetworkAPI>;

    /** Extension storage APIs */
    storage: Partial<GemigoStorageAPI>;

    /** Show a notification */
    notify?(options: NotifyOptions): Promise<NotifyResult>;
}

// ============================================================================
// Global Declaration
// ============================================================================

declare global {
    interface Window {
        gemigo?: GemigoSDK;
    }
}

// ============================================================================
// SDK Access Functions
// ============================================================================

/**
 * Check if the GemiGo SDK is available.
 */
export function isGemigoAvailable(): boolean {
    return typeof window !== 'undefined' && typeof window.gemigo !== 'undefined';
}

/**
 * Get the GemiGo SDK instance.
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

/**
 * Check if the storage API is available.
 */
export function hasStorageAPI(): boolean {
    return typeof window.gemigo?.storage?.get === 'function';
}

/**
 * Direct access proxy to the GemiGo SDK.
 * 
 * @example
 * ```ts
 * import { gemigo } from './gemigo-sdk';
 * 
 * const html = await gemigo.extension.getPageHTML();
 * const links = await gemigo.extension.extractLinks();
 * ```
 */
export const gemigo: GemigoSDK = new Proxy({} as GemigoSDK, {
    get(_, prop: keyof GemigoSDK) {
        const sdk = getGemigoSDK();
        if (!sdk) {
            console.warn('[GemiGo] SDK not available. Are you running in the extension?');
            return undefined;
        }
        return sdk[prop];
    },
});
