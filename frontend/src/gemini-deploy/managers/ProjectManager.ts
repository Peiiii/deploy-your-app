import { useProjectStore } from '../stores/projectStore';
import type { IProjectProvider } from '../services/interfaces';
import { SourceType, type DeploymentMetadata, type Project } from '../types';

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

  /**
   * Check whether the current user already has a project for the given
   * repository URL. This is used by the deployment wizard so that we can
   * guide the user to redeploy instead of accidentally creating a duplicate
   * project (which would conflict on slug / URL).
   */
  findExistingProjectForRepo = async (
    repoUrl: string,
  ): Promise<Project | null> => {
    try {
      return await this.provider.findProjectByRepoUrl(repoUrl);
    } catch (error) {
      console.error('Failed to check existing project for repo', error);
      return null;
    }
  };

  addProject = async (
    name: string,
    sourceType: SourceType,
    sourceIdentifier: string,
    options?: { htmlContent?: string; metadata?: DeploymentMetadata },
  ): Promise<Project | undefined> => {
    try {
      const newProject = await this.provider.createProject(
        name,
        sourceType,
        sourceIdentifier,
        options,
      );
      useProjectStore.getState().actions.addProject(newProject);
      return newProject;
    } catch (error) {
      console.error("Failed to create project", error);
      return undefined;
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
      isPublic?: boolean;
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

  deleteProject = async (id: string) => {
    try {
      await this.provider.deleteProject(id);
      const actions = useProjectStore.getState().actions;
      actions.setProjects(
        useProjectStore
          .getState()
          .projects.filter((p) => p.id !== id),
      );
    } catch (error) {
      console.error('Failed to delete project', error);
      throw error;
    }
  };
}
