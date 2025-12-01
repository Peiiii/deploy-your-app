import * as fs from 'fs';
import * as path from 'path';
import type { Project } from './types.js';
import { rootDir } from './paths.js';

// For local Node/Express development we keep projects in a simple JSON file
// under data/projects.json so that they survive backend restarts. The shape
// mirrors the Project type, which makes it straightforward to later swap
// this implementation for a Cloudflare D1-backed repository in the Worker
// runtime.

type ProjectRow = Project;

export interface CreateProjectRecordInput {
  id: string;
  name: string;
  repoUrl: string;
  sourceType?: 'github' | 'zip';
  analysisId?: string;
  lastDeployed: string;
  status: Project['status'];
  url?: string;
  framework: Project['framework'];
  deployTarget?: 'local' | 'cloudflare';
  providerUrl?: string;
  cloudflareProjectName?: string;
}

const dataDir = path.join(rootDir, 'data');
const projectsFile = path.join(dataDir, 'projects.json');

function ensureStorage(): void {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(projectsFile)) {
    fs.writeFileSync(projectsFile, '[]', 'utf8');
  }
}

function readAllRows(): ProjectRow[] {
  ensureStorage();
  const raw = fs.readFileSync(projectsFile, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as ProjectRow[];
    }
    return [];
  } catch {
    return [];
  }
}

function writeAllRows(rows: ProjectRow[]): void {
  ensureStorage();
  fs.writeFileSync(projectsFile, JSON.stringify(rows, null, 2), 'utf8');
}

export function createProjectRecord(input: CreateProjectRecordInput): Project {
  const project: Project = {
    id: input.id,
    name: input.name,
    repoUrl: input.repoUrl,
    sourceType: input.sourceType,
    analysisId: input.analysisId,
    lastDeployed: input.lastDeployed,
    status: input.status,
    url: input.url,
    framework: input.framework,
    deployTarget: input.deployTarget,
    providerUrl: input.providerUrl,
    cloudflareProjectName: input.cloudflareProjectName,
  };

  const rows = readAllRows();
  rows.unshift(project);
  writeAllRows(rows);

  return project;
}

export function getAllProjects(): Project[] {
  const rows = readAllRows();
  // Return a shallow copy to avoid accidental mutation.
  return rows.map((row) => ({ ...row }));
}
