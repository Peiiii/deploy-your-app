import React, { type ReactNode } from 'react';
import { PageLayout } from '@/components/page-layout';
import { useTranslation } from 'react-i18next';
import { Share2, Check, Copy } from 'lucide-react';
import { usePresenter } from '@/contexts/presenter-context';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

interface ProfileLayoutProps {
    children: ReactNode;
}

export const ProfileLayout: React.FC<ProfileLayoutProps> = ({ children }) => {
    const { t } = useTranslation();
    const presenter = usePresenter();

    const { copied, copyToClipboard } = useCopyToClipboard({
        onSuccess: () => {
            presenter.ui.showSuccessToast(t('profile.profileLinkCopied'));
        },
    });

    return (
        <PageLayout title={t('profile.myProfile')} actions={
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                aria-label={t('profile.viewPublicProfile')}
                                onClick={presenter.myProfile.openPublicProfile}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors bg-white dark:bg-slate-800 shadow-sm"
                            >
                                <Share2 className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">{t('profile.viewPublicProfile')}</span>
                            </button>
                            <button
                                type="button"
                                aria-label={t('profile.copyProfileLink')}
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

        }>
          <p className="text-sm text-app-muted">{t('profile.yourCommunityProfile')}</p>
          {children}
        </PageLayout>
    );
};
