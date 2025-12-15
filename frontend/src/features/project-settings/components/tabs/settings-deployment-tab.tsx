import React from 'react';
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
            <div className="glass-card rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
                <ProjectSettingsDeploymentGroup
                    project={project}
                    canDeployFromGitHub={canDeployFromGitHub}
                />
            </div>
        </div>
    );
};
