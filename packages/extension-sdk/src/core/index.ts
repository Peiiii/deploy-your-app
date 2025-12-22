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

export type { HostMethods, ChildMethods } from './connection';

