import React from 'react';
import { useTranslation } from 'react-i18next';
import { Share2, Check, Copy } from 'lucide-react';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { usePresenter } from '@/contexts/presenter-context';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

export const ProfileHeader: React.FC = () => {
    const { t } = useTranslation();
    const presenter = usePresenter();
    const user = useAuthStore((s) => s.user);

    const { copied, copyToClipboard } = useCopyToClipboard({
        onSuccess: () => {
            presenter.ui.showSuccessToast(t('profile.profileLinkCopied'));
        },
    });

    if (!user) return null;

    return (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-brand-500 to-purple-600 flex items-center justify-center text-lg font-semibold text-white">
                    {(user.displayName || user.email || 'U').toUpperCase().charAt(0)}
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                        {t('profile.title')}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {t('profile.yourCommunityProfile')}
                    </p>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={presenter.myProfile.openPublicProfile}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                    <Share2 className="w-4 h-4" />
                    {t('profile.viewPublicProfile')}
                </button>
                <button
                    type="button"
                    onClick={() => presenter.myProfile.copyPublicUrl(copyToClipboard)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    {t('profile.copyProfileLink')}
                </button>
            </div>
        </div>
    );
};
