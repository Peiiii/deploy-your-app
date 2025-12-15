import React from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { SourceType } from '@/types';
import { DeploymentCard } from '@/features/home/components/deployment-card';
import { DEPLOYMENT_OPTIONS } from '@/features/home/components/deployment-options';

interface HomeDeploySectionProps {
  compact: boolean;
  onQuickDeploy: (sourceType: SourceType) => void;
}

export const HomeDeploySection: React.FC<HomeDeploySectionProps> = ({
  compact,
  onQuickDeploy,
}) => {
  const { t } = useTranslation();

  return (
    <section
      className={`glass-card rounded-2xl md:rounded-3xl p-5 md:p-8 lg:p-10 relative overflow-hidden group/section ${compact ? 'lg:p-6' : ''
        }`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 via-transparent to-purple-500/5 opacity-0 group-hover/section:opacity-100 transition-opacity duration-500" />
      <div className="relative z-10">
        <div className={`flex items-center justify-between ${compact ? 'mb-6' : 'mb-8'}`}>
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Sparkles
                className={`text-brand-500 animate-pulse ${compact ? 'w-5 h-5' : 'w-5 h-5 md:w-6 md:h-6'}`}
              />
              <h2
                className={`font-bold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-white dark:via-slate-100 dark:to-white bg-clip-text text-transparent ${compact ? 'text-xl md:text-2xl' : 'text-2xl sm:text-3xl md:text-4xl'
                  }`}
              >
                {t('deployment.deployYourApp')}
              </h2>
            </div>
            <p className={`text-slate-600 dark:text-slate-400 ${compact ? 'text-xs md:text-sm' : 'text-sm md:text-base'}`}>
              {t('deployment.chooseDeploymentMethod')}
            </p>
          </div>
        </div>

        <div
          className={`grid gap-4 md:gap-5 ${compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            }`}
        >
          {DEPLOYMENT_OPTIONS.map((option) => (
            <DeploymentCard
              key={option.id}
              option={option}
              compact={compact}
              onClick={() => onQuickDeploy(option.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

