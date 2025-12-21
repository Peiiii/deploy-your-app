/**
 * Browser Extension API types
 * These APIs are only available when gemigo.platform === 'extension'
 */

/** Page information */
export interface PageInfo {
  url: string;
  title: string;
  favIconUrl?: string;
}

/** DOM element information */
export interface ElementInfo {
  text: string;
  html: string;
  rect: DOMRect;
}

/** Extracted article content */
export interface ArticleContent {
  title: string;
  content: string;
  author?: string;
  date?: string;
}

/** Link information */
export interface LinkInfo {
  text: string;
  href: string;
}

/** Image information */
export interface ImageInfo {
  src: string;
  alt: string;
  width: number;
  height: number;
}

/** Highlight options */
export interface HighlightOptions {
  /** Highlight color */
  color?: string;
  /** Duration in ms before auto-remove */
  duration?: number;
}

/** Widget position */
export interface WidgetPosition {
  x: number;
  y: number;
}

/** Widget configuration */
export interface WidgetConfig {
  /** HTML content */
  html: string;
  /** Position on page */
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | WidgetPosition;
}

/** Widget handle for controlling inserted widget */
export interface WidgetHandle {
  /** Remove the widget from page */
  remove(): void;
  /** Update widget HTML content */
  update(html: string): void;
}

/** Full page capture options */
export interface CaptureFullOptions {
  /** Maximum height in pixels (default: 30000) */
  maxHeight?: number;
}

/** Context menu event */
export interface ContextMenuEvent {
  menuId: string;
  selectionText?: string;
  pageUrl?: string;
}

/** Context menu event result */
export interface ContextMenuEventResult {
  success: boolean;
  event?: ContextMenuEvent;
}

/** Capture result */
export interface CaptureResult {
  success: boolean;
  dataUrl?: string;
  error?: string;
}

/** Browser Extension API */
export interface ExtensionAPI {
  // ========== Menu & Interaction ==========

  /**
   * Listen for context menu clicks
   * @param callback - Event handler
   * @returns Unsubscribe function
   */
  onContextMenu(callback: (event: ContextMenuEvent) => void): () => void;

  /**
   * Get pending context menu event (when app opened via context menu)
   */
  getContextMenuEvent(): Promise<ContextMenuEventResult>;

  /**
   * Handle selection action button click
   * @param actionId - Action ID from manifest
   * @param callback - Handler function
   */
  onSelectionAction(actionId: string, callback: () => void): () => void;

  // ========== Page Content Reading ==========

  /**
   * Get current tab's page info
   */
  getPageInfo(): Promise<PageInfo>;

  /**
   * Get full page HTML
   * @throws CROSS_ORIGIN error for cross-origin iframes
   */
  getPageHTML(): Promise<string>;

  /**
   * Get page text content (stripped of HTML tags)
   */
  getPageText(): Promise<string>;

  /**
   * Query element by CSS selector
   * @param selector - CSS selector
   * @returns Element info or null
   */
  queryElement(selector: string): Promise<ElementInfo | null>;

  /**
   * Extract article content using Readability algorithm
   */
  extractArticle(): Promise<ArticleContent>;

  /**
   * Extract all links from page
   */
  extractLinks(): Promise<LinkInfo[]>;

  /**
   * Extract all images from page
   */
  extractImages(): Promise<ImageInfo[]>;

  // ========== Page Content Modification ==========
  // Requires 'extension.modify' permission

  /**
   * Highlight elements matching selector
   * @param selector - CSS selector
   * @param options - Highlight options
   * @returns Function to remove highlight
   */
  highlight(selector: string, options?: HighlightOptions): Promise<() => void>;

  /**
   * Insert a floating widget on page
   * @param config - Widget configuration
   * @returns Widget handle for control
   */
  insertWidget(config: WidgetConfig): Promise<WidgetHandle>;

  /**
   * Inject custom CSS styles
   * @param css - CSS string
   * @returns Function to remove injected styles
   */
  injectCSS(css: string): Promise<() => void>;

  // ========== Page Events ==========

  /**
   * Listen for text selection changes
   * @param callback - Selection change handler
   * @returns Unsubscribe function
   */
  onSelectionChange(callback: (text: string) => void): () => void;

  /**
   * Listen for page navigation
   * @param callback - Navigation handler
   * @returns Unsubscribe function
   */
  onNavigate(callback: (url: string) => void): () => void;

  /**
   * Listen for page scroll (throttled)
   * @param callback - Scroll handler
   * @returns Unsubscribe function
   */
  onScroll(callback: (scrollY: number) => void): () => void;

  // ========== Screenshot ==========
  // Requires 'extension.capture' permission

  /**
   * Capture visible area screenshot
   */
  captureVisible(): Promise<CaptureResult>;

  /**
   * Capture full page screenshot (long screenshot)
   * @param options - Capture options
   * @returns Base64 PNG data URL
   */
  captureFull(options?: CaptureFullOptions): Promise<string>;

  // ========== Shortcuts ==========
  // Requires 'extension.shortcuts' permission

  /**
   * Register page-level keyboard shortcut
   * @param combo - Key combination (e.g. 'Ctrl+Shift+T')
   * @param callback - Handler function
   * @returns Unregister function
   */
  registerShortcut(combo: string, callback: () => void): () => void;
}
