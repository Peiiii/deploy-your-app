import type { IProjectProvider } from '../interfaces';
import type { Project } from '../../types';
import { APP_CONFIG, API_ROUTES } from '../../constants';

export class HttpProjectProvider implements IProjectProvider {
  private baseUrl = APP_CONFIG.API_BASE_URL;

  async getProjects(): Promise<Project[]> {
    const response = await fetch(`${this.baseUrl}${API_ROUTES.PROJECTS}`);
    if (!response.ok) throw new Error("Failed to fetch projects");
    return response.json();
  }

  async createProject(name: string, sourceType: 'github' | 'zip', identifier: string): Promise<Project> {
    const response = await fetch(`${this.baseUrl}${API_ROUTES.PROJECTS}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, sourceType, identifier })
    });
    if (!response.ok) throw new Error("Failed to create project");
    return response.json();
  }
}
