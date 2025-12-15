import { AlertTriangle } from 'lucide-react';
import React from 'react';
import { ProjectSettingsHeader } from '@/features/project-settings/components/ProjectSettingsHeader';
import { ProjectSettingsBasicInfoGroup } from '@/features/project-settings/components/ProjectSettingsBasicInfoGroup';
import { ProjectSettingsDeploymentGroup } from '@/features/project-settings/components/ProjectSettingsDeploymentGroup';
import { ProjectSettingsDisplayGroup } from '@/features/project-settings/components/ProjectSettingsDisplayGroup';
import { ProjectSettingsPublicUrlSection } from '@/features/project-settings/components/ProjectSettingsPublicUrlSection';
import { ProjectSettingsSidebar } from '@/features/project-settings/components/ProjectSettingsSidebar';
import type { Project } from '../types';

interface ProjectSettingsCardProps {
  project: Project;
  canDeployFromGitHub: boolean;
  error: string | null;
  onDeleteProject: () => void;
}

export const ProjectSettingsCard: React.FC<ProjectSettingsCardProps> = ({
  project,
  canDeployFromGitHub,
  error,
  onDeleteProject,
}) => {
  return (
    <div className="glass-card rounded-2xl p-6 md:p-8 flex flex-col gap-8">
      <ProjectSettingsHeader project={project} />

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        <div className="flex-1 space-y-8">
          <ProjectSettingsPublicUrlSection projectUrl={project.url} />

          <div className="border-t border-slate-200 dark:border-slate-800 pt-8">
            <ProjectSettingsBasicInfoGroup project={project} />
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-8">
            <ProjectSettingsDeploymentGroup
              project={project}
              canDeployFromGitHub={canDeployFromGitHub}
            />
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-8">
            <ProjectSettingsDisplayGroup project={project} />
          </div>
        </div>

        <ProjectSettingsSidebar
          project={project}
          onDeleteProject={onDeleteProject}
        />
      </div>

      {error && (
        <div className="flex items-start gap-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 shadow-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
        </div>
      )}
    </div>
  );
};
