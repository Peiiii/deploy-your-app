import { useProjectStore } from '../stores/projectStore';
import type { IProjectProvider } from '../services/interfaces';

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
    url: string,
    sourceType: 'github' | 'zip',
    sourceIdentifier: string
  ) => {
    try {
      const newProject = await this.provider.createProject(name, url, sourceType, sourceIdentifier);
      useProjectStore.getState().actions.addProject(newProject);
    } catch (error) {
      console.error("Failed to create project", error);
    }
  };
}
