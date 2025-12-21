/**
 * Message Handler Types
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MessageHandler = (message: any, sender: chrome.runtime.MessageSender) => any;

export type MessageHandlerMap = Record<string, MessageHandler>;
