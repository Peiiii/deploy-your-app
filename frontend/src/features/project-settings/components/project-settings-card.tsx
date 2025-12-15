import { AlertTriangle } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { ProjectLayout, type ProjectLayoutTab } from '@/features/project-settings/components/project-layout';
import { SettingsGeneralTab } from '@/features/project-settings/components/tabs/settings-general-tab';
import { SettingsDeploymentTab } from '@/features/project-settings/components/tabs/settings-deployment-tab';
import { SettingsDisplayTab } from '@/features/project-settings/components/tabs/settings-display-tab';
import { SettingsAnalyticsTab } from '@/features/project-settings/components/tabs/settings-analytics-tab';
import type { Project } from '@/types';

interface ProjectSettingsCardProps {
  project: Project;
  canDeployFromGitHub: boolean;
  error: string | null;
  onDeleteProject: () => void;
}

type TabId = 'general' | 'deployments' | 'display' | 'analytics';

export const ProjectSettingsCard: React.FC<ProjectSettingsCardProps> = ({
  project,
  canDeployFromGitHub,
  error,
  onDeleteProject,
}) => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabId) || 'general';

  // Validate tab to ensure it's a valid TabId, fallback to general
  const validTab = ['general', 'deployments', 'display', 'analytics'].includes(initialTab)
    ? initialTab
    : 'general';

  const [activeTab, setActiveTabState] = useState<TabId>(validTab);

  // Sync state with URL if URL changes externally (e.g. back button)
  React.useEffect(() => {
    const currentTab = searchParams.get('tab') as TabId;
    if (currentTab && ['general', 'deployments', 'display', 'analytics'].includes(currentTab)) {
      setActiveTabState(currentTab);
    }
  }, [searchParams]);

  const handleTabChange = (id: string) => {
    const newTab = id as TabId;
    setActiveTabState(newTab);
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      newParams.set('tab', newTab);
      return newParams;
    });
  };

  const tabs: ProjectLayoutTab[] = [
    { id: 'general', label: t('project.general', 'General') },
    { id: 'deployments', label: t('project.deployments', 'Deployments') },
    { id: 'display', label: t('project.display', 'Display') },
    { id: 'analytics', label: t('project.analytics', 'Analytics') },
  ];

  return (
    <ProjectLayout
      project={project}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={handleTabChange}
    >
      {/* Error Banner */}
      {
        error && (
          <div className="mb-6 flex items-start gap-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 shadow-sm animate-fade-in">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
          </div>
        )
      }

      {/* Tab Content */}
      {
        activeTab === 'general' && (
          <SettingsGeneralTab project={project} onDeleteProject={onDeleteProject} />
        )
      }

      {
        activeTab === 'deployments' && (
          <SettingsDeploymentTab
            project={project}
            canDeployFromGitHub={canDeployFromGitHub}
          />
        )
      }

      {activeTab === 'display' && <SettingsDisplayTab project={project} />}

      {activeTab === 'analytics' && <SettingsAnalyticsTab project={project} />}
    </ProjectLayout >
  );
};
