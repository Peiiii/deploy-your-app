import { useProjectSettingsStore } from '@/features/project-settings/stores/projectSettingsStore';
import { useProjectStore } from '@/stores/projectStore';
import type { Project } from '@/types';
import type { ProjectManager } from '@/managers/ProjectManager';
import type { UIManager } from '@/managers/UIManager';

/**
 * Handles metadata save operations for project settings.
 */
export class MetadataHandler {
    constructor(
        private projectManager: ProjectManager,
        private uiManager: UIManager,
    ) { }

    private getCurrentProject = (): Project | null => {
        const projectId = useProjectSettingsStore.getState().projectId;
        if (!projectId) return null;
        return useProjectStore.getState().projects.find((p) => p.id === projectId) || null;
    };

    isSlugEditable = (project: Project): boolean => {
        return project.status !== 'Live' && project.status !== 'Building';
    };

    saveRepoUrl = async () => {
        const project = this.getCurrentProject();
        if (!project) return;

        const repoUrlDraft = useProjectSettingsStore.getState().repoUrlDraft;
        const actions = useProjectSettingsStore.getState().actions;

        actions.setError(null);
        actions.setIsSavingRepoUrl(true);

        try {
            await this.projectManager.updateProject(project.id, {
                repoUrl: repoUrlDraft.trim(),
            });
        } catch (err) {
            console.error(err);
            actions.setError('Failed to update repository URL.');
        } finally {
            actions.setIsSavingRepoUrl(false);
        }
    };

    saveMetadata = async () => {
        const project = this.getCurrentProject();
        if (!project) return;

        const state = useProjectSettingsStore.getState();
        const actions = state.actions;

        actions.setError(null);
        actions.setIsSavingMetadata(true);

        try {
            const trimmedName = state.nameDraft.trim();
            const trimmedDescription = state.descriptionDraft.trim();
            const trimmedCategory = state.categoryDraft.trim();
            const trimmedSlug = state.slugDraft.trim();
            const slugIsEditable = this.isSlugEditable(project);
            const tagsArray =
                state.tagsDraft
                    .split(',')
                    .map((t) => t.trim())
                    .filter((t) => t.length > 0) ?? [];

            await this.projectManager.updateProject(project.id, {
                ...(trimmedName ? { name: trimmedName } : {}),
                ...(slugIsEditable && trimmedSlug ? { slug: trimmedSlug } : {}),
                ...(trimmedDescription ? { description: trimmedDescription } : {}),
                ...(trimmedCategory ? { category: trimmedCategory } : {}),
                ...(tagsArray.length > 0 ? { tags: tagsArray } : { tags: [] }),
            });
            this.uiManager.showSuccessToast('Metadata saved successfully.');
        } catch (err) {
            console.error(err);
            this.uiManager.showErrorToast('Failed to update project metadata.');
        } finally {
            actions.setIsSavingMetadata(false);
        }
    };
}
