import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface AppPreviewContentProps {
    name: string;
    url: string;
    onOpenInNewTab: (url: string) => void;
}

// This session is keyed by app + URL in the panel. Layout changes keep it alive.
export function AppPreviewContent({ name, url, onOpenInNewTab }: AppPreviewContentProps) {
    const { t } = useTranslation();
    const [status, setStatus] = useState<'loading' | 'slow' | 'visible'>('loading');
    const [attempt, setAttempt] = useState(0);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const loadingRef = useRef<HTMLDivElement>(null);
    const focusOnReveal = useRef(false);
    const waiting = status !== 'visible';

    useEffect(() => {
        if (status !== 'loading') return;
        const timer = window.setTimeout(() => setStatus(current => current === 'loading' ? 'slow' : current), 10_000);
        return () => window.clearTimeout(timer);
    }, [status, attempt]);

    useEffect(() => {
        if (!waiting && focusOnReveal.current) {
            iframeRef.current?.focus({ preventScroll: true });
            focusOnReveal.current = false;
        }
    }, [waiting]);

    const reveal = () => {
        focusOnReveal.current = loadingRef.current?.contains(document.activeElement) ?? false;
        setStatus('visible');
    };

    return (
        <div className="absolute inset-0 bg-[#f8f6ff] dark:bg-[#141020]" data-preview-state={status}>
            <iframe
                key={attempt}
                ref={iframeRef}
                src={url}
                className={`h-full w-full select-none border-0 transition-opacity duration-150 motion-reduce:transition-none ${waiting ? 'opacity-0' : 'opacity-100'}`}
                title={name}
                aria-hidden={waiting}
                inert={waiting}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                onLoad={event => {
                    if (event.currentTarget === iframeRef.current) reveal();
                }}
            />
            {waiting && (
                <div ref={loadingRef} className="absolute inset-0 flex flex-col items-center justify-center overflow-y-auto px-6 py-16">
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
                    <div role="status" className={status === 'slow' ? 'mt-2 text-center text-xs text-slate-500 dark:text-slate-400' : 'sr-only'}>
                        {t(status === 'slow' ? 'previewLoading.slow' : 'common.loading')}
                    </div>
                    {status === 'slow' && (
                        <div className="mt-2 flex max-w-full flex-wrap justify-center gap-1">
                            <button type="button" onClick={() => { setStatus('loading'); setAttempt(current => current + 1); }} className="rounded-md px-2 py-2 text-xs text-slate-500 hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-slate-400 dark:hover:bg-white/10">
                                {t('common.retry')}
                            </button>
                            <button type="button" onClick={reveal} className="rounded-md px-2 py-2 text-xs text-slate-500 hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-slate-400 dark:hover:bg-white/10">
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
