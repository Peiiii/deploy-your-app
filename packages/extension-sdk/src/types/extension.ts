/**
 * Browser Extension API types
 *
 * These APIs are only available when `gemigo.platform === 'extension'`.
 *
 * Note: This file defines the v1 "stable surface" used by the current Host/SW
 * implementation. Future APIs are kept as optional to avoid blocking v1.
 */

export interface PageInfo {
  url: string;
  title: string;
  favIconUrl?: string;
}

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SelectionResult {
  text: string;
  rect: SelectionRect | null;
}

export interface ElementInfo {
  tagName: string;
  text: string;
  attributes: Record<string, string>;
}

export interface ArticleContent {
  title: string;
  content: string;
  excerpt?: string;
  url?: string;
}

export interface LinkInfo {
  href: string;
  text: string;
  title?: string;
}

export interface ImageInfo {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface HighlightOptions {
  color?: string;
  duration?: number;
}

export interface WidgetPosition {
  x: number;
  y: number;
}

export interface WidgetConfig {
  html: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | WidgetPosition;
}

export interface WidgetHandle {
  remove(): void;
  update(html: string): void;
}

export interface CaptureFullOptions {
  maxHeight?: number;
}

export interface ContextMenuEvent {
  menuId: string;
  selectionText?: string;
  pageUrl?: string;
}

export interface ContextMenuEventResult {
  success: boolean;
  event?: ContextMenuEvent;
}

export interface CaptureResult {
  success: boolean;
  dataUrl?: string;
  error?: string;
}

export interface HighlightResult {
  success: boolean;
  count?: number;
  highlightId?: string;
  error?: string;
}

export interface WidgetResult {
  success: boolean;
  widgetId?: string;
  error?: string;
}

export interface CSSResult {
  success: boolean;
  styleId?: string;
  error?: string;
}

export interface ExtractArticleResult {
  success: boolean;
  title?: string;
  content?: string;
  excerpt?: string;
  url?: string;
  error?: string;
}

export interface ExtractLinksResult {
  success: boolean;
  links?: LinkInfo[];
  error?: string;
}

export interface ExtractImagesResult {
  success: boolean;
  images?: ImageInfo[];
  error?: string;
}

export interface QueryElementResult {
  success: boolean;
  elements?: ElementInfo[];
  count?: number;
  error?: string;
}

/**
 * Extension RPC Methods - shared between SDK and Host
 *
 * These methods are the actual RPC calls to the extension host.
 * HostMethods extends this interface.
 */
export interface ExtensionRPCMethods {
  getPageInfo(): Promise<PageInfo | null>;

  getPageHTML(): Promise<string>;
  getPageText(): Promise<string>;
  getSelection(): Promise<SelectionResult>;

  extractArticle(): Promise<ExtractArticleResult>;
  extractLinks(): Promise<ExtractLinksResult>;
  extractImages(): Promise<ExtractImagesResult>;
  queryElement(selector: string, limit?: number): Promise<QueryElementResult>;

  highlight(selector: string, color?: string): Promise<HighlightResult>;
  removeHighlight(highlightId: string): Promise<{ success: boolean; error?: string }>;

  insertWidget(html: string, position?: string | WidgetPosition): Promise<WidgetResult>;
  updateWidget(widgetId: string, html: string): Promise<{ success: boolean; error?: string }>;
  removeWidget(widgetId: string): Promise<{ success: boolean; error?: string }>;

  injectCSS(css: string): Promise<CSSResult>;
  removeCSS(styleId: string): Promise<{ success: boolean; error?: string }>;

  captureVisible(): Promise<CaptureResult>;

  getContextMenuEvent(): Promise<ContextMenuEventResult>;
}

/**
 * Full Extension API - includes RPC methods + local event handlers
 */
export interface ExtensionAPI extends ExtensionRPCMethods {
  // Local event handlers (not RPC)
  onContextMenu(callback: (event: ContextMenuEvent) => void): () => void;
  onSelectionChange(
    handler: (text: string, rect: SelectionRect | null, url?: string) => void
  ): () => void;

  // Planned (optional) APIs.
  onSelectionAction?: (actionId: string, callback: () => void) => () => void;
  onNavigate?: (callback: (url: string) => void) => () => void;
  onScroll?: (callback: (scrollY: number) => void) => () => void;
  captureFull?: (options?: CaptureFullOptions) => Promise<CaptureResult>;
  registerShortcut?: (combo: string, callback: () => void) => () => void;
}
