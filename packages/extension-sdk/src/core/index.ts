/**
 * Core Module
 */

export {
  getHost,
  tryGetHost,
  initConnection,
  isConnected,
  hasConnectionFailed,
  callHost,
  createRPCProxy,
  withFallback,
} from './connection';

export { createEventBus, sdkEventBus, createCallbackHandler, createEventPair } from './event-bus';
export type { EventBus, EventHandler, SDKEvents } from './event-bus';

export { createUnifiedAPI } from './api-factory';
export type { APIConfig } from './api-factory';

export type { HostMethods, ChildMethods } from './connection';




