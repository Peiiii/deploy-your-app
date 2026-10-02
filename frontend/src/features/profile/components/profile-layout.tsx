import React, { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Share2, Check, Copy } from 'lucide-react';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { usePresenter } from '@/contexts/presenter-context';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

interface ProfileLayoutProps {
    children: ReactNode;
}

export const ProfileLayout: React.FC<ProfileLayoutProps> = ({ children }) => {
    const { t } = useTranslation();
    const presenter = usePresenter();
    const user = useAuthStore((s) => s.user);

    const { copied, copyToClipboard } = useCopyToClipboard({
        onSuccess: () => {
            presenter.ui.showSuccessToast(t('profile.profileLinkCopied'));
        },
    });

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-black/20">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20">
                <div className="max-w-5xl mx-auto px-4 md:px-8">
                    <div className="h-20 flex items-center justify-between">
                        {/* User Info (Left) */}
                        <div className="flex items-center gap-4">
                            {user && (
                                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-500 to-purple-600 flex items-center justify-center text-sm font-semibold text-white shadow-sm ring-2 ring-white dark:ring-slate-800">
                                    {(user.displayName || user.email || 'U').toUpperCase().charAt(0)}
                                </div>
                            )}
                            <div>
                                <h1 className="text-xl font-bold text-slate-900 dark:text-white leading-none mb-1">
                                    {t('profile.myProfile')}
                                </h1>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                    {t('profile.yourCommunityProfile')}
                                </p>
                            </div>
                        </div>

                        {/* Actions (Right) */}
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={presenter.myProfile.openPublicProfile}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors bg-white dark:bg-slate-800 shadow-sm"
                            >
                                <Share2 className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">{t('profile.viewPublicProfile')}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => presenter.myProfile.copyPublicUrl(copyToClipboard)}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors bg-white dark:bg-slate-800 shadow-sm"
                            >
                                {copied ? (
                                    <Check className="w-3.5 h-3.5 text-green-500" />
                                ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                )}
                                <span className="hidden sm:inline">{t('profile.copyProfileLink')}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-8">
                    {children}
                </div>
            </div>
        </div>
    );
};
