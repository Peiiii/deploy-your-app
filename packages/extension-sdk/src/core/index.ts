/**
 * Core Module
 */

export {
  getHost,
  tryGetHost,
  initConnection,
  isConnected,
  hasConnectionFailed,
} from './connection';

export type { HostMethods, ChildMethods } from './connection';
