import React from 'react';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import { usePresenter } from '@/contexts/PresenterContext';

export const ProfileSignInRequired: React.FC = () => {
    const { t } = useTranslation();
    const presenter = usePresenter();

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto flex items-center justify-center h-full animate-fade-in">
            <div className="glass-card rounded-2xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur max-w-md w-full text-center space-y-4">
                <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <Lock className="w-6 h-6 text-slate-500 dark:text-slate-300" />
                </div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                    {t('profile.signInRequiredTitle')}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t('profile.signInRequiredDescription')}
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                    <button
                        onClick={() => presenter.auth.openAuthModal('login')}
                        className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 transition-all min-w-[120px]"
                    >
                        {t('common.signIn')}
                    </button>
                </div>
            </div>
        </div>
    );
};
