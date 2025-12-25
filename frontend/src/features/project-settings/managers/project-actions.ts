import { useProjectSettingsStore } from '@/features/project-settings/stores/project-settings.store';
import { useProjectStore } from '@/stores/project.store';
import type { Project } from '@/types';
import type { ProjectManager } from '@/managers/project.manager';
import type { UIManager } from '@/managers/ui.manager';
import type { AuthManager } from '@/features/auth/managers/auth.manager';
import type { ReactionManager } from '@/managers/reaction.manager';
import type { AnalyticsManager } from '@/managers/analytics.manager';
import i18n from '@/i18n/config';

/**
 * Handles project-level actions like delete, visibility toggle, reactions.
 */
export class ProjectActions {
    constructor(
        private projectManager: ProjectManager,
        private uiManager: UIManager,
        private authManager: AuthManager,
        private reactionManager: ReactionManager,
        private analyticsManager: AnalyticsManager,
    ) { }

    private getCurrentProject = (): Project | null => {
        const projectId = useProjectSettingsStore.getState().projectId;
        if (!projectId) return null;
        return useProjectStore.getState().projects.find((p) => p.id === projectId) || null;
    };

    initializeForm = (project: Project) => {
        useProjectSettingsStore.getState().actions.initializeFromProject(project);
    };

    loadAnalytics = (projectId: string, range: '7d' | '30d' = '7d') => {
        this.analyticsManager.loadProjectStats(projectId, range);
    };

    loadReactions = (projectId: string) => {
        this.reactionManager.loadReactionsForProject(projectId);
    };

    togglePublicVisibility = async () => {
        const project = this.getCurrentProject();
        if (!project) return;

        const actions = useProjectSettingsStore.getState().actions;
        actions.setError(null);

        try {
            const nextValue = !(project.isPublic ?? true);
            await this.projectManager.updateProject(project.id, { isPublic: nextValue });
        } catch (err) {
            console.error(err);
            const t = i18n.t.bind(i18n);
            actions.setError(t('project.failedToUpdateVisibility'));
        }
    };

    toggleExtensionSupport = async () => {
        const project = this.getCurrentProject();
        if (!project) return;

        const actions = useProjectSettingsStore.getState().actions;
        actions.setError(null);

        try {
            const nextValue = !(project.isExtensionSupported ?? false);
            await this.projectManager.updateProject(project.id, { isExtensionSupported: nextValue });
        } catch (err) {
            console.error(err);
            const t = i18n.t.bind(i18n);
            actions.setError(t('project.failedToUpdateExtensionSupport', 'Failed to update extension support.'));
        }
    };

    deleteProject = async (): Promise<boolean> => {
        const project = this.getCurrentProject();
        if (!project) return false;

        const t = i18n.t.bind(i18n);
        const confirmed = await this.uiManager.showConfirm({
            title: t('project.dangerZone'),
            message: t('project.deleteConfirm'),
            primaryLabel: t('project.deleteProject'),
            secondaryLabel: t('common.cancel'),
        });

        if (!confirmed) return false;

        const actions = useProjectSettingsStore.getState().actions;
        actions.setError(null);

        try {
            await this.projectManager.deleteProject(project.id);
            return true;
        } catch (err) {
            console.error(err);
            actions.setError(t('project.failedToDelete'));
            return false;
        }
    };

    toggleLike = () => {
        const project = this.getCurrentProject();
        if (!project) return;

        const user = this.authManager.getCurrentUser();
        if (!user) {
            this.authManager.openAuthModal('login');
            return;
        }

        this.reactionManager.toggleLike(project.id);
    };

    toggleFavorite = () => {
        const project = this.getCurrentProject();
        if (!project) return;

        const user = this.authManager.getCurrentUser();
        if (!user) {
            this.authManager.openAuthModal('login');
            return;
        }

        this.reactionManager.toggleFavorite(project.id);
    };

    resetForm = () => {
        useProjectSettingsStore.getState().actions.resetForm();
    };
}
