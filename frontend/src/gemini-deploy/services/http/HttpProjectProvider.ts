import type { IProjectProvider } from '../interfaces';
import type { Project, DeploymentMetadata } from '../../types';
import { SourceType } from '../../types';
import { APP_CONFIG, API_ROUTES } from '../../constants';

export class HttpProjectProvider implements IProjectProvider {
  private baseUrl = APP_CONFIG.API_BASE_URL;

  async getProjects(): Promise<Project[]> {
    const response = await fetch(`${this.baseUrl}${API_ROUTES.PROJECTS}`);
    if (!response.ok) throw new Error("Failed to fetch projects");
    return response.json();
  }

  async createProject(
    name: string,
    sourceType: SourceType,
    identifier: string,
    options?: { htmlContent?: string; metadata?: DeploymentMetadata },
  ): Promise<Project> {
    const response = await fetch(`${this.baseUrl}${API_ROUTES.PROJECTS}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        sourceType,
        identifier,
        ...(options?.htmlContent
          ? { htmlContent: options.htmlContent }
          : {}),
        ...(options?.metadata ? { metadata: options.metadata } : {}),
      }),
    });
    if (!response.ok) throw new Error("Failed to create project");
    return response.json();
  }

  async updateProject(
    id: string,
    patch: {
      name?: string;
      repoUrl?: string;
      description?: string;
      category?: string;
      tags?: string[];
      isPublic?: boolean;
    },
  ): Promise<Project> {
    const response = await fetch(`${this.baseUrl}${API_ROUTES.PROJECTS}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!response.ok) throw new Error("Failed to update project");
    return response.json();
  }
}
