import { LoadingSprite } from '@/components/loading-sprite';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface AppPreviewContentProps {
    name: string;
    url: string;
    onOpenInNewTab: (url: string) => void;
    onFavicon: (url: string, href: string) => void;
    onLoadingChange: (url: string, loading: boolean) => void;
}

// Keep one browsing window: native navigation retains the old page until commit.
export function AppPreviewContent({ name, url, onOpenInNewTab, onFavicon, onLoadingChange }: AppPreviewContentProps) {
    const { t } = useTranslation();
    const [session, setSession] = useState<{ url: string; status: 'loading' | 'slow' | 'visible'; attempt: number; requestId: string; loaded: boolean }>({ url, status: 'loading', attempt: 0, requestId: crypto.randomUUID(), loaded: false });
    if (session.url !== url) {
        setSession({ url, status: 'loading', attempt: session.attempt, requestId: crypto.randomUUID(), loaded: false });
    }
    const { status, attempt, requestId: faviconRequestId } = session;
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const loadingRef = useRef<HTMLDivElement>(null);
    const focusOnDismiss = useRef(false);
    useEffect(() => { onLoadingChange(url, !session.loaded); }, [url, session.loaded, onLoadingChange]);
    const waiting = status !== 'visible';

    useEffect(() => {
        const origin = new URL(url).origin;
        const onMessage = (event: MessageEvent) => {
            if (event.source !== iframeRef.current?.contentWindow || event.origin !== origin ||
                event.data?.type !== 'gemigo:favicon' || event.data.requestId !== faviconRequestId ||
                typeof event.data.href !== 'string' || event.data.href.length > 100_000) return;
            const href = event.data.href;
            if (/^https?:/i.test(href) || /^data:image\/(?:png|jpeg|gif|webp|svg\+xml|x-icon)[;,]/i.test(href)) onFavicon(url, href);
        };
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, [url, faviconRequestId, onFavicon]);

    useEffect(() => {
        if (status !== 'loading') return;
        const timer = window.setTimeout(() => setSession(current =>
            current.url === url && current.attempt === attempt && current.status === 'loading'
                ? { ...current, status: 'slow' } : current), 10_000);
        return () => window.clearTimeout(timer);
    }, [url, status, attempt]);

    useEffect(() => {
        if (!waiting && focusOnDismiss.current) {
            iframeRef.current?.focus({ preventScroll: true });
            focusOnDismiss.current = false;
        }
    }, [waiting]);

    const dismissFeedback = () => {
        focusOnDismiss.current = loadingRef.current?.contains(document.activeElement) ?? false;
        setSession(current => ({ ...current, status: 'visible' }));
    };

    return (
        <div className="absolute inset-0 bg-[#f8f6ff] dark:bg-[#141020]" data-preview-state={status}>
            {waiting && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <LoadingSprite />
                </div>
            )}
            {/* Never gate app paint or interaction on load; feedback sits underneath. */}
            <iframe
                key={attempt}
                ref={iframeRef}
                src={url}
                className="relative h-full w-full select-none border-0"
                title={name}
                allow="camera; microphone"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                onLoad={event => {
                    if (event.currentTarget === iframeRef.current) {
                        dismissFeedback();
                        setSession(current => ({ ...current, loaded: true }));
                        onLoadingChange(url, false);
                        event.currentTarget.contentWindow?.postMessage({ type: 'gemigo:request-favicon', requestId: faviconRequestId }, new URL(url).origin);
                    }
                }}
            />
            {waiting && (
                <div ref={loadingRef} className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-col items-center">
                    <div role="status" className={status === 'slow' ? 'rounded-md bg-white/90 px-2 py-1 text-center text-xs text-slate-500 dark:bg-slate-900/90 dark:text-slate-400' : 'sr-only'}>
                        {t(status === 'slow' ? 'previewLoading.slow' : 'common.loading')}
                    </div>
                    {status === 'slow' && (
                        <div className="pointer-events-auto mt-1 flex max-w-full flex-wrap justify-center gap-1 rounded-md bg-white/90 dark:bg-slate-900/90">
                            <button type="button" onClick={() => {
                                setSession(current => ({ ...current, status: 'loading', attempt: current.attempt + 1, requestId: crypto.randomUUID(), loaded: false }));
                            }} className="rounded-md px-2 py-2 text-xs text-slate-500 hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-slate-400 dark:hover:bg-white/10">
                                {t('common.retry')}
                            </button>
                            <button type="button" onClick={dismissFeedback} className="rounded-md px-2 py-2 text-xs text-slate-500 hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-slate-400 dark:hover:bg-white/10">
                                {t('previewLoading.showApp')}
                            </button>
                            <button type="button" onClick={() => onOpenInNewTab(url)} className="rounded-md px-2 py-2 text-xs text-slate-500 hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-slate-400 dark:hover:bg-white/10">
                                {t('common.openInNewTab')}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
