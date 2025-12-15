import { AlertTriangle, BarChart3, Image, Settings } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ProjectSettingsHeader } from '@/features/project-settings/components/project-settings-header';
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
  const [activeTab, setActiveTab] = useState<TabId>('general');

  const tabs = [
    {
      id: 'general' as const,
      label: t('project.general', 'General'),
      icon: Settings,
      description: t('project.generalDesc', 'Basic info & visibility'),
    },
    {
      id: 'deployments' as const,
      label: t('project.deployments', 'Deployments'),
      icon: RocketIcon,
      description: t('project.deploymentsDesc', 'Source & redeploy'),
    },
    {
      id: 'display' as const,
      label: t('project.display', 'Display'),
      icon: Image,
      description: t('project.displayDesc', 'Thumbnail & assets'),
    },
    {
      id: 'analytics' as const,
      label: t('project.analytics', 'Analytics'),
      icon: BarChart3,
      description: t('project.analyticsDesc', 'Views & insights'),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* Settings Header (Identity) - Always visible */}
      <div className="glass-card rounded-2xl p-6 md:p-8">
        <ProjectSettingsHeader project={project} />
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Left Vertical Navigation */}
        <nav className="w-full lg:w-64 flex-shrink-0 flex flex-col gap-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-start gap-3 p-3 rounded-xl text-left transition-all ${isActive
                  ? 'bg-brand-50/80 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 ring-1 ring-brand-200 dark:ring-brand-800'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
              >
                <Icon
                  className={`w-5 h-5 mt-0.5 ${isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'
                    }`}
                />
                <div>
                  <div className={`text-sm font-medium ${isActive ? 'font-semibold' : ''}`}>
                    {tab.label}
                  </div>
                  {isActive && (
                    <div className="text-[11px] opacity-80 mt-0.5 leading-tight">
                      {tab.description}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </nav>

        {/* Right Content Area */}
        <div className="flex-1 min-w-0">
          {error && (
            <div className="mb-6 flex items-start gap-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 shadow-sm animate-fade-in">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="flex-1">{error}</span>
            </div>
          )}

          {activeTab === 'general' && (
            <SettingsGeneralTab project={project} onDeleteProject={onDeleteProject} />
          )}

          {activeTab === 'deployments' && (
            <SettingsDeploymentTab
              project={project}
              canDeployFromGitHub={canDeployFromGitHub}
            />
          )}

          {activeTab === 'display' && <SettingsDisplayTab project={project} />}

          {activeTab === 'analytics' && <SettingsAnalyticsTab project={project} />}
        </div>
      </div>
    </div>
  );
};

// Simple rocket icon since Lucide Rocket might conflict or needs import
const RocketIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
  </svg>
);
