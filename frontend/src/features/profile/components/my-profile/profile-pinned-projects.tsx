import React from 'react';
import { useTranslation } from 'react-i18next';
import { GripVertical, Pin } from 'lucide-react';
import { useMyProfileStore } from '@/features/profile/stores/my-profile-store';
import { usePresenter } from '@/contexts/presenter-context';

export const ProfilePinnedProjects: React.FC = () => {
    const { t } = useTranslation();
    const presenter = usePresenter();

    const pinnedIds = useMyProfileStore((s) => s.pinnedIds);
    const draggingPinnedId = useMyProfileStore((s) => s.draggingPinnedId);
    const actions = useMyProfileStore((s) => s.actions);

    const myProjects = presenter.myProfile.getMyProjects();

    const pinnedProjects = pinnedIds
        .map((id) => myProjects.find((p) => p.id === id))
        .filter((p): p is (typeof myProjects)[number] => !!p);

    if (pinnedProjects.length === 0) return null;

    const handleDragStart = (e: React.DragEvent, projectId: string) => {
        e.stopPropagation();
        presenter.myProfile.handlePinnedDragStart(projectId);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>, projectId: string) => {
        if (!draggingPinnedId || draggingPinnedId === projectId) return;
        if (!pinnedIds.includes(projectId)) return;
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>, projectId: string) => {
        e.preventDefault();
        e.stopPropagation();
        presenter.myProfile.handlePinnedDrop(projectId);
    };

    return (
        <div className="glass-card rounded-xl p-5 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-3">
                <div>
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {t('profile.pinnedApps')}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t('profile.pinnedAppsDescription')}
                    </p>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pinnedProjects.map((project) => (
                    <div
                        key={project.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, project.id)}
                        onDragOver={(e) => handleDragOver(e, project.id)}
                        onDrop={(e) => handleDrop(e, project.id)}
                        onDragEnd={presenter.myProfile.handlePinnedDragEnd}
                        className={`flex items-start gap-3 rounded-lg border px-3 py-2 transition-all cursor-move border-brand-500/60 bg-brand-50 dark:bg-brand-900/20 ${draggingPinnedId === project.id ? 'opacity-80 ring-1 ring-brand-500/60' : ''
                            }`}
                    >
                        <GripVertical className="mt-1 w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                                {project.name}
                            </div>
                            {project.description && (
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                                    {project.description}
                                </div>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                actions.togglePinned(project.id);
                            }}
                            className="flex items-center gap-1 flex-shrink-0 hover:opacity-80"
                            title={t('profile.pinnedApps')}
                        >
                            <Pin className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};
