import React from 'react';
import { ProjectSettingsDisplayGroup } from '@/features/project-settings/components/project-settings-display-group';
import type { Project } from '@/types';

interface SettingsDisplayTabProps {
    project: Project;
}

export const SettingsDisplayTab: React.FC<SettingsDisplayTabProps> = ({
    project,
}) => {
    return (
        <div className="space-y-8 animate-fade-in">
            <div className="glass-card rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
                <ProjectSettingsDisplayGroup project={project} />
            </div>
        </div>
    );
};
