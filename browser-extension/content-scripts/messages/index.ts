/**
 * Content Script Messages Index
 */

import type { MessageHandlerMap } from '../types';
import { pageMessages } from './page';
import { widgetMessages } from './widget';
import { styleMessages } from './style';
import { highlightMessages } from './highlight';
import { extractMessages } from './extract';

export const allMessages: MessageHandlerMap = {
  ...pageMessages,
  ...widgetMessages,
  ...styleMessages,
  ...highlightMessages,
  ...extractMessages,
};
