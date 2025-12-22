/**
 * GemiGo Content Script - Entry Point
 * 
 * Composes handlers and starts the controller.
 */

import { contentController } from './content-controller';
import { domHandlers } from './handlers/dom';
import { extractHandlers } from './handlers/extract';
import { uiHandlers } from './handlers/ui';

// Inject handlers
contentController.provideHandlers({
    ...domHandlers,
    ...extractHandlers,
    ...uiHandlers,
});

// Start services
contentController.start();
