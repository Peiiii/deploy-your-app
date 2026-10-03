import { useDeploymentStore } from '@/features/deployment/stores/deployment.store';
import { useProjectStore } from '@/stores/project.store';
import type { ProjectManager } from '@/managers/project.manager';
import type { Project } from '@/types';
import { getPublicationName, getPublicationSlug } from './publication-details';

type DeploymentStoreSnapshot = ReturnType<typeof useDeploymentStore.getState>;

export class ProjectCreator {
  constructor(private projectManager: ProjectManager) {}

  getFallbackNameFromState = (state: DeploymentStoreSnapshot): string => getPublicationName(state);

  createFromWizard = async (): Promise<Project> => {
    const state = useDeploymentStore.getState();
    if (state.newProjectId) {
      const existing = useProjectStore.getState().projects.find((p) => p.id === state.newProjectId);
      if (!existing) throw new Error('This project is no longer available.');
      return existing;
    }
    const slug = getPublicationSlug(state);
    const project = await this.projectManager.createDraftProject(
      this.getFallbackNameFromState(state),
      slug
    );
    if (!project) throw new Error('Failed to create project.');
    state.actions.setNewProjectId(project.id);
    if (project.slug !== slug) throw new Error('The saved address does not match your selection. Please retry.');
    state.actions.setPublicationSlug(slug);
    return project;
  };
}
