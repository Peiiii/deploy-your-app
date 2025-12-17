import React, { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import { getProjectLiveUrl } from '@/utils/project';
import type { Project } from '@/types';

export interface ProjectLayoutTab {
    id: string;
    label: string;
}

interface ProjectLayoutProps {
    project: Project;
    tabs: ProjectLayoutTab[];
    activeTab: string;
    onTabChange: (tabId: string) => void;
    children: ReactNode;
    /** Optional action buttons to render in the header */
    actions?: ReactNode;
}

/**
 * Unified project layout with Header + Horizontal Tabs pattern.
 * Inspired by GitHub/Vercel project pages.
 */
export const ProjectLayout: React.FC<ProjectLayoutProps> = ({
    project,
    tabs,
    activeTab,
    onTabChange,
    children,
    actions,
}) => {
    const { t } = useTranslation();

    // Generate project URL - prefer canonical URL with provider fallback
    const projectUrl = getProjectLiveUrl(project);

    // Generate initials for icon
    const initials = project.name
        .split(/[\s-_]+/)
        .slice(0, 2)
        .map((word) => word[0]?.toUpperCase() || '')
        .join('');

    return (
        <div className="flex flex-col min-h-0">
            {/* Header Section */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 pt-8 pb-0 px-6 md:px-8 sticky top-0 z-20">
                <div className="max-w-6xl mx-auto">
                    {/* Project Identity Row */}
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8">
                        <div className="flex items-center gap-4">
                            {/* Project Icon */}
                            <div className="w-14 h-14 bg-gradient-to-br from-brand-500 to-purple-600 rounded-xl shadow-lg shadow-brand-500/20 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                                {initials || 'P'}
                            </div>

                            {/* Project Info */}
                            <div className="min-w-0">
                                <h1 className="text-2xl font-bold text-slate-900 dark:text-white truncate">
                                    {project.name}
                                </h1>
                                {projectUrl ? (
                                    <a
                                        href={projectUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors group"
                                    >
                                        <span className="truncate max-w-[200px] md:max-w-[300px]">
                                            {projectUrl.replace(/^https?:\/\//, '')}
                                        </span>
                                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </a>
                                ) : null}
                            </div>
                        </div>

                        {/* Status Badge + Actions */}
                        <div className="flex items-center gap-3 flex-shrink-0">
                            {project.isPublic !== false && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    {t('project.live', 'Live')}
                                </span>
                            )}
                            {actions}
                        </div>
                    </div>

                    {/* Horizontal Tabs */}
                    <nav className="flex gap-1 -mb-px overflow-x-auto">
                        {tabs.map((tab) => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => onTabChange(tab.id)}
                                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${isActive
                                        ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
                                        : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            );
                        })}
                    </nav>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 bg-slate-50 dark:bg-slate-950 py-8 px-6 md:px-8">
                <div className="max-w-6xl mx-auto">
                    {children}
                </div>
            </div>
        </div>
    );
};
