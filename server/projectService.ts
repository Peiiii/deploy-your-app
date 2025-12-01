import { randomUUID } from 'crypto';
import { projects } from './state.js';
import type { Project } from './types.js';
import { slugify } from './utils.js';

export function getProjects(): Project[] {
  return projects;
}

interface CreateProjectInput {
  name: string;
  sourceType?: 'github' | 'zip';
  identifier: string;
}

export function createProject({
  name,
  sourceType,
  identifier,
}: CreateProjectInput): Project {
  const id = randomUUID();
  const now = new Date().toISOString();
  const slug = slugify(name);

  const url = `/apps/${encodeURIComponent(slug)}/`;

  const project: Project = {
    id,
    name,
    repoUrl: identifier,
    sourceType,
    lastDeployed: now,
    status: 'Live',
    url,
    framework: 'Unknown',
  };

  projects.unshift(project);
  return project;
}

