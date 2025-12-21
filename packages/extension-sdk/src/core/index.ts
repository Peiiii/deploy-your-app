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
} from './connection';

export type { HostMethods, ChildMethods } from './connection';
