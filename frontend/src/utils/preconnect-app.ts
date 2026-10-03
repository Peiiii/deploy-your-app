/** Warm just the latest intended destination; never fetch or execute an app. */
export function preconnectApp(url?: string) {
    if (!url) return;
    let target: URL;
    try {
        target = new URL(url, window.location.href);
    } catch {
        return;
    }
    if (!['https:', 'http:'].includes(target.protocol) || target.origin === window.location.origin) return;
    let link = document.head.querySelector<HTMLLinkElement>('link[data-app-preview-preconnect]');
    if (link?.href === `${target.origin}/`) return;
    if (!link) {
        link = document.createElement('link');
        link.rel = 'preconnect';
        link.dataset.appPreviewPreconnect = '';
        document.head.appendChild(link);
    }
    link.href = target.origin;
}
