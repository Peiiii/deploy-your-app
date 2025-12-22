/**
 * GemiGo Browser Extension - Service Worker
 * 
 * Main entry point.
 */

import { backgroundController } from './backgruond-controller';
import { createTransparentHandlers } from './utils/bridge';
import { commonHandlers } from './handlers/common';
import { networkHandlers } from './handlers/network';

// Inject stateless handlers and start the service
backgroundController.provideHandlers({
    ...commonHandlers,
    ...networkHandlers,
    ...createTransparentHandlers(['onSelectionChange', 'onContextMenu']),
});

backgroundController.start();
