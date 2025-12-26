/**
 * AI API types
 */

/** Chat message */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/** Chat response */
export interface ChatResponse {
  role: 'assistant';
  content: string;
}

/** Translation options */
export interface TranslateOptions {
  /** Source language (auto-detect if not specified) */
  from?: string;
  /** Target language (required) */
  to: string;
}

/** Translation result */
export interface TranslateResult {
  text: string;
  from: string;
  to: string;
}

/** AI API for cloud model integration */
export interface AIAPI {
  /**
   * Multi-turn conversation
   * @param messages - Conversation history
   * @returns Assistant response
   */
  chat(messages: ChatMessage[]): Promise<ChatResponse>;

  /**
   * Summarize text content
   * @param text - Text to summarize
   * @returns Summary text
   */
  summarize(text: string): Promise<string>;

  /**
   * Translate text
   * @param text - Text to translate
   * @param options - Translation options
   * @returns Translation result
   */
  translate(text: string, options: TranslateOptions): Promise<TranslateResult>;
}
