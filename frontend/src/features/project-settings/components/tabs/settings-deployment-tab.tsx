import { DeploymentSession } from '@/features/deployment/components/deployment-session';
import React from 'react';
import { DeploymentResult } from '../deployment-result';
import { ProjectSettingsDeploymentGroup } from '@/features/project-settings/components/project-settings-deployment-group';
import type { Project } from '@/types';

interface SettingsDeploymentTabProps {
    project: Project;
    canDeployFromGitHub: boolean;
}

export const SettingsDeploymentTab: React.FC<SettingsDeploymentTabProps> = ({
    project,
    canDeployFromGitHub,
}) => {
    return (
        <div className="space-y-8 animate-fade-in">
            {/* Deployment Management Controls */}
            <div className="glass-card rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
                <ProjectSettingsDeploymentGroup
                    key={project.id}
                    project={project}
                    canDeployFromGitHub={canDeployFromGitHub}
                />
            </div>

            {/* Active Deployment Session or Result */}
            <DeploymentSession projectId={project.id} />
            <DeploymentResult key={project.id} projectId={project.id} />
        </div>
    );
};
