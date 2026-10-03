import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface AppPreviewContentProps {
    name: string;
    url: string;
    onOpenInNewTab: (url: string) => void;
}

// Keep one browsing window: native navigation retains the old page until commit.
export function AppPreviewContent({ name, url, onOpenInNewTab }: AppPreviewContentProps) {
    const { t } = useTranslation();
    const [session, setSession] = useState<{ url: string; status: 'loading' | 'slow' | 'visible'; attempt: number }>({ url, status: 'loading', attempt: 0 });
    if (session.url !== url) {
        setSession({ url, status: 'loading', attempt: session.attempt });
    }
    const { status, attempt } = session;
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const loadingRef = useRef<HTMLDivElement>(null);
    const focusOnDismiss = useRef(false);
    const waiting = status !== 'visible';

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
                    <svg viewBox="0 0 112 64" className="preview-sprite h-10 w-20 shrink-0" aria-hidden="true">
                        <g transform="translate(16 8) scale(1.5)">
                            <g className="preview-sprite-jaw">
                                <path d="M16 16 L16 4 A12 12 0 0 1 28 16 Z" fill="#a78bfa" />
                                <path d="M16 16 L28 16 A12 12 0 0 1 16 28 Z" fill="#7c3aed" />
                                <path d="M16 16 L16 28 A12 12 0 0 1 4 16 Z" fill="#5b21b6" />
                                <path d="M16 16 L4 16 A12 12 0 0 1 16 4 Z" fill="#8b5cf6" />
                            </g>
                        </g>
                        {[0, 1, 2].map(index => (
                            <circle key={index} className="preview-sprite-dot" cx="102" cy="32" r="2.5" fill="#a78bfa" style={{ animationDelay: `${index * -0.6}s` }} />
                        ))}
                    </svg>
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
                    if (event.currentTarget === iframeRef.current) dismissFeedback();
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
                                setSession(current => ({ ...current, status: 'loading', attempt: current.attempt + 1 }));
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
