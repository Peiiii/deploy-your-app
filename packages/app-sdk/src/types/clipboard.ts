/**
 * Clipboard API types
 */

/** Clipboard content */
export interface ClipboardContent {
  text?: string;
  image?: Blob;
}

/** Clipboard change callback */
export type ClipboardChangeCallback = (content: ClipboardContent) => void;

/** Clipboard API */
export interface ClipboardAPI {
  /**
   * Read text from clipboard
   * @returns Clipboard text content
   */
  readText(): Promise<string>;

  /**
   * Write text to clipboard
   * @param text - Text to write
   */
  writeText(text: string): Promise<void>;

  /**
   * Read image from clipboard
   * @returns Image blob or null
   */
  readImage(): Promise<Blob | null>;

  /**
   * Write image to clipboard
   * @param blob - Image blob to write
   */
  writeImage(blob: Blob): Promise<void>;

  /**
   * Listen for clipboard content changes (desktop only)
   * @param callback - Change callback
   * @returns Unsubscribe function
   */
  onChange(callback: ClipboardChangeCallback): () => void;
}
