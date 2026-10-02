import { useDeploymentStore } from '@/features/deployment/stores/deployment.store';
import { useProjectStore } from '@/stores/project.store';
import type { ProjectManager } from '@/managers/project.manager';
import { SourceType, type Project } from '@/types';

type DeploymentStoreSnapshot = ReturnType<typeof useDeploymentStore.getState>;

export class ProjectCreator {
  constructor(private projectManager: ProjectManager) {}

  getFallbackNameFromState = (state: DeploymentStoreSnapshot): string => {
    if (state.projectName.trim()) return state.projectName.trim();
    if (state.sourceType === SourceType.GITHUB)
      return (
        state.repoUrl
          .split('/')
          .filter(Boolean)
          .pop()
          ?.replace(/\.git$/, '') || 'my-app'
      );
    if (state.sourceType === SourceType.ZIP)
      return state.zipFile?.name.replace(/\.zip$/i, '') || 'my-app';
    const title = state.htmlContent
      .match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
      .replace(/<[^>]*>/g, '')
      .trim();
    return title?.slice(0, 80) || 'my-html-app';
  };

  createFromWizard = async (): Promise<Project> => {
    const state = useDeploymentStore.getState();
    if (state.newProjectId) {
      const existing = useProjectStore.getState().projects.find((p) => p.id === state.newProjectId);
      if (!existing) throw new Error('This project is no longer available.');
      return existing;
    }
    const project = await this.projectManager.createDraftProject(
      this.getFallbackNameFromState(state)
    );
    if (!project) throw new Error('Failed to create project.');
    state.actions.setNewProjectId(project.id);
    return project;
  };
}
