import type { IProjectProvider } from '../interfaces';
import type { Project } from '../../types';
import { SourceType } from '../../types';
import { db } from '../db';
import { URLS } from '../../constants';

// --- Seed Data for First Run ---
const SEED_PROJECTS: Project[] = [
  {
    id: 'seed-1',
    name: 'travel-planner-ai',
    repoUrl: `${URLS.GITHUB_BASE}johndoe/travel-planner-ai`,
    sourceType: SourceType.GITHUB,
    lastDeployed: '2 hours ago',
    status: 'Live',
    url: undefined, // URL should come from backend
    framework: 'React',
    category: 'Development',
  },
  {
    id: 'seed-2',
    name: 'gemini-chatbot-v2',
    repoUrl: `${URLS.GITHUB_BASE}johndoe/gemini-chatbot`,
    sourceType: SourceType.GITHUB,
    lastDeployed: '1 day ago',
    status: 'Failed',
    framework: 'Next.js',
    category: 'Development',
  }
];

export class IndexedDBProjectProvider implements IProjectProvider {
  async getProjects(): Promise<Project[]> {
    // Check if empty, if so, seed data
    const count = await db.count('projects');
    if (count === 0) {
        for (const p of SEED_PROJECTS) {
            await db.add('projects', p);
        }
    }
    return db.getAll<Project>('projects');
  }

  async findProjectByRepoUrl(repoUrl: string): Promise<Project | null> {
    const all = await this.getProjects();
    return all.find((p) => p.repoUrl === repoUrl) ?? null;
  }

  async createProject(
    name: string,
    sourceType: SourceType,
    identifier: string,
    options?: { htmlContent?: string },
  ): Promise<Project> {
    const newProject: Project = {
      id: crypto.randomUUID(), // Use native browser UUID
      name: name,
      repoUrl: identifier,
      sourceType: sourceType,
      lastDeployed: 'Just now',
      status: 'Live',
      url: undefined, // URL will be set by backend after deployment
      framework: 'React', // In a real app, this is detected during build
      category: 'Development',
      htmlContent: options?.htmlContent,
    };
    
    await db.add('projects', newProject);
    return newProject;
  }

  async updateProject(
    id: string,
    patch: {
      name?: string;
      repoUrl?: string;
      description?: string;
      category?: string;
      tags?: string[];
    },
  ): Promise<Project> {
    const project = await db.get<Project>('projects', id);
    if (!project) {
      throw new Error(`Project with id ${id} not found`);
    }
    const updated: Project = {
      ...project,
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.repoUrl !== undefined ? { repoUrl: patch.repoUrl } : {}),
      ...(patch.description !== undefined
        ? { description: patch.description }
        : {}),
      ...(patch.category !== undefined ? { category: patch.category } : {}),
      ...(patch.tags !== undefined ? { tags: patch.tags.slice() } : {}),
    };
    await db.put('projects', updated);
    return updated;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async uploadThumbnail(id: string, _file: File): Promise<void> {
    // Thumbnails are only persisted in the real backend (API + R2). For the
    // IndexedDB mock provider we simply no-op so the UI can still call the
    // method without failing in local/demo mode.
    const project = await db.get<Project>('projects', id);
    if (!project) {
      throw new Error(`Project with id ${id} not found`);
    }
  }

  async deleteProject(id: string): Promise<void> {
    await db.delete('projects', id);
  }
}
