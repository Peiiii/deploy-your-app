/**
 * Core module exports
 */

export { getHost, initConnection } from './connection';
export type { HostMethods, ChildMethods } from './connection';

export { on, emit, getChildMethods } from './event-bus';
export type { EventHandlerMap, EventName } from './event-bus';
