import type { IProjectProvider } from '../interfaces';
import type { Project, DeploymentMetadata } from '../../types';
import { APP_CONFIG, API_ROUTES } from '../../constants';

export class HttpProjectProvider implements IProjectProvider {
  private baseUrl = APP_CONFIG.API_BASE_URL;

  async getProjects(): Promise<Project[]> {
    const response = await fetch(`${this.baseUrl}${API_ROUTES.PROJECTS}`);
    if (!response.ok) throw new Error("Failed to fetch projects");
    return response.json();
  }

  async findProjectByRepoUrl(repoUrl: string): Promise<Project | null> {
    const response = await fetch(
      `${this.baseUrl}${API_ROUTES.PROJECT_BY_REPO}?repoUrl=${encodeURIComponent(
        repoUrl,
      )}`,
    );

    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error('Failed to inspect existing projects for repo');
    }
    const data = (await response.json()) as { project?: Project | null };
    return data.project ?? null;
  }

  async createDraftProject(
    name?: string,
  ): Promise<Project> {
    const response = await fetch(`${this.baseUrl}${API_ROUTES.PROJECTS}/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(name ? { name } : {}),
      }),
    });
    if (!response.ok) throw new Error('Failed to create draft project');
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
      slug?: string;
      repoUrl?: string;
      description?: string;
      category?: string;
      tags?: string[];
      isPublic?: boolean;
    },
  ): Promise<Project> {
    const response = await fetch(
      `${this.baseUrl}${API_ROUTES.PROJECTS}/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      },
    );
    if (!response.ok) throw new Error('Failed to update project');
    return response.json();
  }

  async updateProjectDeployment(
    id: string,
    patch: {
      status?: Project['status'];
      lastDeployed?: string;
      url?: string;
      deployTarget?: Project['deployTarget'];
      providerUrl?: string;
      cloudflareProjectName?: string;
    },
  ): Promise<Project> {
    const response = await fetch(
      `${this.baseUrl}${API_ROUTES.PROJECTS}/${encodeURIComponent(
        id,
      )}/deployment`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      },
    );
    if (!response.ok) {
      throw new Error('Failed to update project deployment status');
    }
    return response.json();
  }

  async uploadThumbnail(id: string, file: File): Promise<void> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(
      `${this.baseUrl}${API_ROUTES.PROJECTS}/${encodeURIComponent(
        id,
      )}/thumbnail`,
      {
        method: 'POST',
        body: formData,
      },
    );

    if (!response.ok) {
      let message = 'Failed to upload project thumbnail';
      try {
        const data = (await response.json()) as {
          error?: unknown;
          code?: unknown;
        };
        if (data && typeof data.error === 'string' && data.error.trim().length) {
          message = data.error.trim();
        }
      } catch {
        // Ignore JSON parse errors and fall back to the generic message.
      }
      throw new Error(message);
    }
  }

  async deleteProject(id: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}${API_ROUTES.PROJECTS}/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      },
    );
    if (!response.ok) {
      throw new Error('Failed to delete project');
    }
  }
}
