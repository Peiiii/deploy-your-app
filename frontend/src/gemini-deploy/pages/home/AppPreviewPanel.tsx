import React from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, X, Zap } from 'lucide-react';
import type { ExploreAppCard } from '../../components/ExploreAppCard';
import { AuthorBadge } from '../../components/AuthorBadge';

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
        <div className="hidden lg:flex lg:flex-col w-1/2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-3xl border border-slate-200/60 dark:border-slate-800/60 shadow-2xl overflow-hidden flex-shrink-0 h-[calc(100vh-4rem-3rem)] animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200/80 dark:border-slate-800/80 bg-gradient-to-r from-slate-50/80 to-white/80 dark:from-slate-900/80 dark:to-slate-800/80 backdrop-blur-sm flex-shrink-0">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br ${app.color} shrink-0 shadow-lg ring-2 ring-white/20 dark:ring-slate-700/30`}>
                        <Zap className="w-6 h-6 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white truncate mb-1">
                            {app.name}
                        </h3>
                        <AuthorBadge
                            name={app.author}
                            identifier={app.authorProfileIdentifier}
                        />
                    </div>
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
                        className="w-full h-full border-0 rounded-b-3xl"
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
