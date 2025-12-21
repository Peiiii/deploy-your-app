/**
 * Background Messages Index
 */

import type { MessageHandlerMap } from '../types';
import { pageMessages } from './page';
import { networkMessages } from './network';
import { captureMessages } from './capture';
import { contextMenuMessages } from './context-menu';

export { setPendingContextMenuEvent } from './context-menu';

export const allMessages: MessageHandlerMap = {
  ...pageMessages,
  ...networkMessages,
  ...captureMessages,
  ...contextMenuMessages,
};
