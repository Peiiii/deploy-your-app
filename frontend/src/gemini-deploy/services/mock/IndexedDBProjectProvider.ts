import type { IProjectProvider } from '../interfaces';
import type { Project } from '../../types';
import { db } from '../db';
import { URLS } from '../../constants';

// --- Seed Data for First Run ---
const SEED_PROJECTS: Project[] = [
  {
    id: 'seed-1',
    name: 'travel-planner-ai',
    repoUrl: `${URLS.GITHUB_BASE}johndoe/travel-planner-ai`,
    sourceType: 'github',
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
    sourceType: 'github',
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

  async createProject(name: string, sourceType: 'github' | 'zip', identifier: string): Promise<Project> {
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
    };
    
    await db.add('projects', newProject);
    return newProject;
  }
}
