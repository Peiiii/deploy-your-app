import { useProjectStore } from '../stores/projectStore';
import type { IProjectProvider } from '../services/interfaces';
import { SourceType, type DeploymentMetadata } from '../types';

export class ProjectManager {
  private provider: IProjectProvider;

  constructor(provider: IProjectProvider) {
    this.provider = provider;
  }

  loadProjects = async () => {
    const actions = useProjectStore.getState().actions;
    actions.setIsLoading(true);
    try {
      const projects = await this.provider.getProjects();
      actions.setProjects(projects);
    } catch (error) {
      console.error("Failed to load projects", error);
    } finally {
      actions.setIsLoading(false);
    }
  };

  addProject = async (
    name: string,
    sourceType: SourceType,
    sourceIdentifier: string,
    options?: { htmlContent?: string; metadata?: DeploymentMetadata },
  ) => {
    try {
      const newProject = await this.provider.createProject(
        name,
        sourceType,
        sourceIdentifier,
        options,
      );
      useProjectStore.getState().actions.addProject(newProject);
    } catch (error) {
      console.error("Failed to create project", error);
    }
  };

  updateProject = async (
    id: string,
    patch: {
      name?: string;
      repoUrl?: string;
      description?: string;
      category?: string;
      tags?: string[];
    },
  ) => {
    try {
      const updated = await this.provider.updateProject(id, patch);
      const actions = useProjectStore.getState().actions;
      actions.setProjects(
        useProjectStore.getState().projects.map((p) =>
          p.id === updated.id ? updated : p,
        ),
      );
    } catch (error) {
      console.error("Failed to update project", error);
    }
  };
}
