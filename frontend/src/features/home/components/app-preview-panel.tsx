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
        <div className="flex flex-col w-full h-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md animate-fade-in shadow-none border-none rounded-none">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 h-14 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex-shrink-0 z-10 relative">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <h3 className="font-bold text-base text-slate-900 dark:text-white truncate shrink-0 max-w-[50%]">
                        {app.name}
                    </h3>
                    <AuthorBadge
                        name={app.author}
                        identifier={app.authorProfileIdentifier}
                    />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {app.url && (
                        <button
                            onClick={() => onOpenInNewTab(app.url!)}
                            className="p-2.5 rounded-xl hover:bg-slate-200/80 dark:hover:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-all duration-300 hover:scale-110"
                            aria-label={t('common.openInNewTab')}
                            title={t('common.openInNewTab')}
                        >
                            <ExternalLink className="w-5 h-5" />
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="p-2.5 rounded-xl hover:bg-slate-200/80 dark:hover:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-all duration-300 hover:scale-110"
                        aria-label={t('common.close')}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Iframe */}
            <div className="flex-1 relative bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-950 dark:to-slate-900 min-h-0">
                {app.url ? (
                    <iframe
                        src={app.url}
                        className="w-full h-full border-0 rounded-none"
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
