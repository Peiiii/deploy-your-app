import React from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, X } from 'lucide-react';
import type { ExploreAppCard } from '@/components/explore-app-card';
import { AuthorBadge } from '@/components/author-badge';

interface AppPreviewPanelProps {
    app: ExploreAppCard;
    onClose: () => void;
    onOpenInNewTab: (url: string) => void;
}

export const AppPreviewPanel: React.FC<AppPreviewPanelProps> = ({
    app,
    onClose,
    onOpenInNewTab,
}) => {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col w-full h-full bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-fade-in group relative">

            {/* Glass Edge Effect (Left Border Replacement) */}
            <div className="absolute inset-y-0 left-0 w-[1px] z-50 pointer-events-none bg-gradient-to-b from-white/0 via-white/80 to-white/0 dark:from-white/0 dark:via-white/20 dark:to-white/0 opacity-50"></div>
            <div className="absolute inset-y-0 left-0 w-6 z-40 pointer-events-none bg-gradient-to-r from-slate-900/5 to-transparent dark:from-black/40 dark:to-transparent mix-blend-overlay"></div>
            <div className="absolute inset-y-0 left-0 w-px z-50 pointer-events-none shadow-[1px_0_4px_rgba(255,255,255,0.4)_inset] dark:shadow-[1px_0_4px_rgba(255,255,255,0.1)_inset]"></div>

            {/* Slim Header (External - No Occlusion) */}
            <div className="flex items-center justify-between px-4 h-12 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm flex-shrink-0 z-20">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200 truncate shrink-0 max-w-[50%]">
                        {app.name}
                    </h3>
                    <div className="h-3 w-px bg-slate-200 dark:bg-slate-700"></div>
                    <div className="scale-90 origin-left">
                        <AuthorBadge
                            name={app.author}
                            identifier={app.authorProfileIdentifier}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    {app.url && (
                        <button
                            onClick={() => onOpenInNewTab(app.url!)}
                            className="p-1.5 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800/50 text-slate-400 dark:text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 transition-all"
                            aria-label={t('common.openInNewTab')}
                            title={t('common.openInNewTab')}
                        >
                            <ExternalLink className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800/50 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-all"
                        aria-label={t('common.close')}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Iframe Content (Takes remaining space) */}
            <div className="flex-1 relative bg-slate-100 dark:bg-slate-950 min-h-0">
                {app.url ? (
                    <iframe
                        src={app.url}
                        className="w-full h-full border-0 block"
                        title={app.name}
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                    />
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center space-y-3">
                            <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                                <X className="w-8 h-8 text-slate-400" />
                            </div>
                            <p className="text-slate-500 dark:text-slate-400 font-medium">
                                {t('common.notAccessible')}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
