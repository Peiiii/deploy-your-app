import { CONFIG } from '../../../common/config/config.js';
import type { Project } from '../../../common/types.js';
import type { CreateProjectRecordInput } from './file-project.repository.js';
import { FileProjectRepository } from './file-project.repository.js';
import { CloudflareProjectRepository } from './cloudflare-project.repository.js';

interface ProjectRepository {
  createProjectRecord(input: CreateProjectRecordInput): Promise<Project>;
  getAllProjects(): Promise<Project[]>;
  updateProjectRecord(
    id: string,
    patch: {
      name?: string;
      repoUrl?: string;
      description?: string;
      category?: string;
      tags?: string[];
    },
  ): Promise<Project | null>;
}

const repository: ProjectRepository = 
  CONFIG.storageType === 'd1' && CONFIG.cloudflareD1
    ? new CloudflareProjectRepository(CONFIG.cloudflareD1)
    : new FileProjectRepository();

export const projectRepository = repository;
export type { CreateProjectRecordInput };
