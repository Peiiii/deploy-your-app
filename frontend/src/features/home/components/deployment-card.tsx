import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import type { DeploymentOption } from '@/features/home/components/deployment-options';

interface DeploymentCardProps {
    option: DeploymentOption;
    compact: boolean;
    onClick: () => void;
}

export const DeploymentCard: React.FC<DeploymentCardProps> = ({
    option,
    compact,
    onClick,
}) => {
    const { t } = useTranslation();
    const Icon = option.icon;

    const isDark = option.variant === 'dark';

    return (
        <button
            onClick={onClick}
            className={`group relative text-left overflow-hidden rounded-3xl transition-all duration-300 ${compact ? 'p-5' : 'p-6 md:p-8'
                } ${isDark
                    ? 'bg-[#0f172a] text-white shadow-xl hover:shadow-2xl hover:-translate-y-1'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-black/50 hover:-translate-y-1 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
        >
            <div className="relative z-10 flex flex-col h-full justify-between">
                <div className={`flex items-start justify-between ${compact ? 'mb-4' : 'mb-6'}`}>
                    <div
                        className={`rounded-xl flex items-center justify-center transition-all duration-300 ${compact ? 'w-10 h-10' : 'w-12 h-12'
                            } ${isDark
                                ? 'bg-white/10 text-white'
                                : `bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-600`
                            }`}
                    >
                        <Icon className={compact ? 'w-5 h-5' : 'w-6 h-6'} />
                    </div>

                    {!isDark && (
                        <ArrowRight
                            className={`text-slate-300 dark:text-slate-600 group-hover:text-slate-500 group-hover:translate-x-1 transition-all duration-300 ${compact ? 'w-4 h-4' : 'w-5 h-5'
                                }`}
                        />
                    )}
                    {isDark && (
                        <div className="text-white/30 group-hover:text-white/60 transition-colors">
                            <ArrowRight className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
                        </div>
                    )}
                </div>

                <div>
                    <h3
                        className={`font-bold mb-1 transition-colors ${compact ? 'text-base' : 'text-lg'
                            } ${isDark ? 'text-white' : 'text-slate-900 dark:text-white'}`}
                    >
                        {t(option.titleKey)}
                    </h3>

                    <p className={`font-medium leading-relaxed ${compact ? 'text-xs' : 'text-sm'
                        } ${isDark ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'}`}>
                        {t(option.descriptionKey)}
                    </p>
                </div>
            </div>
        </button>
    );
};
