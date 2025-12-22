/**
 * GemiGo Content Script - Entry Point
 * 
 * Harmonizes Observer and Router layers.
 */

import { initObserver } from './observer';
import { initRouter } from './router';

// Initialize layers
initObserver();
initRouter();

console.log('[GemiGo] Content script initialized on:', window.location.href);
