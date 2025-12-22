/**
 * GemiGo Browser Extension - Service Worker
 * 
 * Main entry point.
 */

import { backgroundController } from './background-controller';


import { commonHandlers } from './handlers/common';
import { networkHandlers } from './handlers/network';

// Inject stateless handlers and start the service
backgroundController.provideHandlers({
    ...commonHandlers,
    ...networkHandlers,
});

backgroundController.start();
