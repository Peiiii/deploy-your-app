import React from 'react';
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

  return (
    <section
      className={`relative group/section mb-8 ${compact ? 'lg:p-6' : ''}`}
    >
      <div className="relative z-10">
        {/* Title removed, managed by parent */}


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

