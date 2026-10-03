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
                <div ref={loadingRef} className="absolute inset-0 flex flex-col items-center justify-center overflow-y-auto bg-[radial-gradient(ellipse_at_center,_#ede9fe_0%,_transparent_65%)] px-6 py-16 dark:bg-[radial-gradient(ellipse_at_center,_#2e2049_0%,_transparent_65%)]">
                    <svg viewBox="0 0 112 64" className="preview-sprite mb-5 h-24 w-44 shrink-0" aria-hidden="true">
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
                    <h2 className="mb-2 max-w-full break-words text-center text-xl font-semibold text-slate-800 dark:text-slate-100">{name}</h2>
                    <div role="status" className="text-center">
                        <p className="text-sm font-medium text-brand-600 dark:text-brand-300">
                            {t(status === 'slow' ? 'previewLoading.slow' : 'previewLoading.opening')}
                        </p>
                        <p className="mt-2 max-w-xs text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                            {t(status === 'slow' ? 'previewLoading.slowHint' : 'previewLoading.companion')}
                        </p>
                    </div>
                    {status === 'slow' && (
                        <div className="mt-5 flex max-w-full flex-wrap justify-center gap-2">
                            <button type="button" onClick={() => { setStatus('loading'); setAttempt(current => current + 1); }} className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-medium text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2">
                                {t('common.retry')}
                            </button>
                            <button type="button" onClick={reveal} className="rounded-lg px-3 py-2 text-xs font-medium text-slate-600 hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-slate-300 dark:hover:bg-white/10">
                                {t('previewLoading.showApp')}
                            </button>
                            <button type="button" onClick={() => onOpenInNewTab(url)} className="rounded-lg px-3 py-2 text-xs font-medium text-slate-600 hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-slate-300 dark:hover:bg-white/10">
                                {t('common.openInNewTab')}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
