import React from 'react';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';

export const ProfileLoadingState: React.FC = () => {
    const { t } = useTranslation();

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto flex items-center justify-center h-full animate-fade-in">
            <div className="glass-card rounded-2xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur max-w-md w-full text-center space-y-4">
                <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center animate-pulse">
                    <Lock className="w-6 h-6 text-slate-500 dark:text-slate-300" />
                </div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                    {t('common.loading')}
                </h2>
            </div>
        </div>
    );
};
