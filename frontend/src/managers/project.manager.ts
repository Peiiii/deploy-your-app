import { useProjectStore } from '../stores/project.store';
import type { IProjectProvider } from '../services/interfaces';
import { SourceType, type DeploymentMetadata, type Project } from '../types';

export class ProjectManager {
  private provider: IProjectProvider;

  constructor(provider: IProjectProvider) {
    this.provider = provider;
  }

  loadProjects = async (page = 1) => {
    const actions = useProjectStore.getState().actions;
    actions.setIsLoading(true);
    try {
      const response = await this.provider.getProjects(page);
      actions.setProjects(response, false);
    } catch (error) {
      console.error("Failed to load projects", error);
    } finally {
      actions.setIsLoading(false);
    }
  };

  loadMore = async () => {
    const { pagination, isLoading } = useProjectStore.getState();

    // Don't load if already loading or no more data
    if (isLoading || !pagination.hasMore) {
      return;
    }

    const actions = useProjectStore.getState().actions;
    actions.setIsLoading(true);

    try {
      const nextPage = pagination.page + 1;
      const response = await this.provider.getProjects(nextPage, pagination.pageSize);
      actions.setProjects(response, true); // append=true
    } catch (error) {
      console.error("Failed to load more projects", error);
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

  createDraftProject = async (
    name?: string,
  ): Promise<Project | undefined> => {
    try {
      const project = await this.provider.createDraftProject(name);
      useProjectStore.getState().actions.addProject(project);
      return project;
    } catch (error) {
      console.error('Failed to create draft project', error);
      return undefined;
    }
  };

  updateProject = async (
    id: string,
    patch: {
      name?: string;
      slug?: string;
      repoUrl?: string;
      description?: string;
      category?: string;
      tags?: string[];
      isPublic?: boolean;
      isExtensionSupported?: boolean;
    },
  ) => {
    try {
      const updated = await this.provider.updateProject(id, patch);
      useProjectStore.setState((state) => ({
        projects: state.projects.map((p) => p.id === updated.id ? updated : p)
      }));
    } catch (error) {
      console.error("Failed to update project", error);
    }
  };

  updateProjectDeployment = async (
    id: string,
    patch: {
      status?: Project['status'];
      lastDeployed?: string;
      url?: string;
      deployTarget?: Project['deployTarget'];
      providerUrl?: string;
      cloudflareProjectName?: string;
    },
  ): Promise<Project | undefined> => {
    try {
      const updated = await this.provider.updateProjectDeployment(id, patch);
      useProjectStore.setState((state) => ({
        projects: state.projects.map((p) => p.id === updated.id ? updated : p)
      }));
      return updated;
    } catch (error) {
      console.error('Failed to update project deployment status', error);
      return undefined;
    }
  };

  uploadThumbnail = async (id: string, file: File): Promise<void> => {
    try {
      await this.provider.uploadThumbnail(id, file);
    } catch (error) {
      console.error('Failed to upload project thumbnail', error);
      throw error;
    }
  };

  deleteProject = async (id: string) => {
    try {
      await this.provider.deleteProject(id);
      useProjectStore.setState((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
        pagination: {
          ...state.pagination,
          total: Math.max(0, state.pagination.total - 1)
        }
      }));
    } catch (error) {
      console.error('Failed to delete project', error);
      throw error;
    }
  };
}
