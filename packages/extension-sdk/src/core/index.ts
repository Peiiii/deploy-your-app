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

export type { HostMethods, ChildMethods } from './connection';



