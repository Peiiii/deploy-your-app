import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import type { DeploymentOption } from './deploymentOptions';

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

    return (
        <button
            onClick={onClick}
            className={`group relative border-2 border-slate-200/60 dark:border-slate-800/60 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm hover:border-${option.hoverColor}-500/60 dark:hover:border-${option.hoverColor}-500/60 hover:shadow-2xl hover:shadow-${option.hoverColor}-500/20 hover:-translate-y-1 transition-all duration-300 text-left overflow-hidden ${compact ? 'p-4 rounded-xl' : 'p-5 md:p-7 rounded-xl md:rounded-2xl'
                }`}
        >
            <div className={`absolute inset-0 bg-gradient-to-br from-${option.hoverColor}-500/0 to-${option.hoverColor}-500/0 group-hover:from-${option.hoverColor}-500/5 group-hover:to-${option.hoverColor}-600/5 transition-all duration-300`} />
            <div className="relative z-10">
                <div className={`flex items-start justify-between ${compact ? 'mb-3' : 'mb-5'}`}>
                    <div
                        className={`rounded-xl bg-gradient-to-br ${option.colorFrom} ${option.colorTo} ${option.bgFrom} ${option.bgTo} group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg ${option.shadowColor} ${compact ? 'p-3' : 'p-4'
                            }`}
                    >
                        <Icon className={`${option.iconColor} ${compact ? 'w-5 h-5' : 'w-7 h-7'}`} />
                    </div>
                    <ArrowRight
                        className={`text-slate-400 group-hover:text-${option.hoverColor}-500 group-hover:translate-x-2 transition-all duration-300 ${compact ? 'w-4 h-4' : 'w-5 h-5'
                            }`}
                    />
                </div>
                <h3
                    className={`font-bold text-slate-900 dark:text-white mb-2 group-hover:text-${option.hoverColor}-600 dark:group-hover:text-${option.hoverColor}-400 transition-colors ${compact ? 'text-base' : 'text-lg'
                        }`}
                >
                    {t(option.titleKey)}
                </h3>
                <p className={`text-slate-600 dark:text-slate-400 leading-relaxed ${compact ? 'text-xs' : 'text-sm'}`}>
                    {t(option.descriptionKey)}
                </p>
            </div>
        </button>
    );
};
