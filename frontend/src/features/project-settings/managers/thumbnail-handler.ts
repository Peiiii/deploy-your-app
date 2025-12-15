import { useProjectSettingsStore } from '@/features/project-settings/stores/project-settings.store';
import { useProjectStore } from '@/stores/project.store';
import type { Project } from '@/types';
import type { ProjectManager } from '@/managers/project.manager';
import type { UIManager } from '@/managers/ui.manager';

/**
 * Handles thumbnail upload operations for project settings.
 */
export class ThumbnailHandler {
    constructor(
        private projectManager: ProjectManager,
        private uiManager: UIManager,
    ) { }

    private getCurrentProject = (): Project | null => {
        const projectId = useProjectSettingsStore.getState().projectId;
        if (!projectId) return null;
        return useProjectStore.getState().projects.find((p) => p.id === projectId) || null;
    };

    uploadThumbnail = async (file: File) => {
        const project = this.getCurrentProject();
        if (!project) return;

        const actions = useProjectSettingsStore.getState().actions;
        const isUploading = useProjectSettingsStore.getState().isUploadingThumbnail;
        if (isUploading) return;

        actions.setError(null);
        actions.setIsUploadingThumbnail(true);

        try {
            await this.projectManager.uploadThumbnail(project.id, file);
            actions.bumpThumbnailVersion();
            this.uiManager.showSuccessToast('Thumbnail uploaded successfully.');
        } catch (err) {
            console.error(err);
            const fallbackMessage = 'Failed to upload thumbnail image.';
            const message = err instanceof Error && err.message ? err.message : fallbackMessage;
            this.uiManager.showErrorToast(message);
        } finally {
            actions.setIsUploadingThumbnail(false);
        }
    };

    handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await this.uploadThumbnail(file);
        e.target.value = '';
    };

    handlePaste = async (event: React.ClipboardEvent<HTMLDivElement>) => {
        const isUploading = useProjectSettingsStore.getState().isUploadingThumbnail;
        if (isUploading) return;

        const { items } = event.clipboardData;
        for (let i = 0; i < items.length; i += 1) {
            const item = items[i];
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (!file) continue;
                event.preventDefault();
                await this.uploadThumbnail(file);
                break;
            }
        }
    };
}
