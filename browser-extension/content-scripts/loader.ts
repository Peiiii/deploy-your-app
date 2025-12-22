/**
 * GemiGo Content Script Loader
 * 
 * Used to load the main bridge as an ES module, allowing shared chunks to work.
 */
(async () => {
    try {
        const src = chrome.runtime.getURL('content-scripts/bridge.js');
        await import(src);
    } catch (err) {
        console.error('[GemiGo] Failed to load bridge module:', err);
    }
})();
