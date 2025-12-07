import * as fs from 'fs';
import type { Project } from '../../../common/types.js';
import { SourceType } from '../../../common/types.js';
import { CONFIG } from '../../../common/config/config.js';

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
  sourceType?: SourceType;
  slug?: string;
  analysisId?: string;
  lastDeployed: string;
  status: Project['status'];
  url?: string;
  description?: string;
  framework: Project['framework'];
  category?: string;
  tags?: string[];
  deployTarget?: Project['deployTarget'];
  providerUrl?: string;
  cloudflareProjectName?: string;
  htmlContent?: string;
}

export class FileProjectRepository {
  private ensureStorage(): void {
    fs.mkdirSync(CONFIG.paths.dataDir, { recursive: true });
    if (!fs.existsSync(CONFIG.paths.projectsFile)) {
      fs.writeFileSync(CONFIG.paths.projectsFile, '[]', 'utf8');
    }
  }

  private readAllRows(): ProjectRow[] {
    this.ensureStorage();
    const raw = fs.readFileSync(CONFIG.paths.projectsFile, 'utf8');
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

  private writeAllRows(rows: ProjectRow[]): void {
    this.ensureStorage();
    fs.writeFileSync(CONFIG.paths.projectsFile, JSON.stringify(rows, null, 2), 'utf8');
  }

  async createProjectRecord(input: CreateProjectRecordInput): Promise<Project> {
    const project: Project = {
      id: input.id,
      name: input.name,
      repoUrl: input.repoUrl,
      sourceType: input.sourceType,
      slug: input.slug,
      analysisId: input.analysisId,
      lastDeployed: input.lastDeployed,
      status: input.status,
      url: input.url,
      description: input.description,
      framework: input.framework,
      category: input.category,
      tags: input.tags,
      deployTarget: input.deployTarget,
      providerUrl: input.providerUrl,
      cloudflareProjectName: input.cloudflareProjectName,
      htmlContent: input.htmlContent,
    };

    const rows = this.readAllRows();
    rows.unshift(project);
    this.writeAllRows(rows);

    return project;
  }

  async getAllProjects(): Promise<Project[]> {
    const rows = this.readAllRows();
    return rows.map((row) => ({
      ...row,
      category: row.category ?? 'Other',
      tags: row.tags ?? [],
    }));
  }

  async updateProjectRecord(
    id: string,
    patch: {
      name?: string;
      repoUrl?: string;
      description?: string;
      category?: string;
      tags?: string[];
    },
  ): Promise<Project | null> {
    const rows = this.readAllRows();
    const idx = rows.findIndex((row) => row.id === id);
    if (idx === -1) return null;

    const current = rows[idx];
    const updated: ProjectRow = {
      ...current,
      ...(patch.name !== undefined ? { name: String(patch.name) } : {}),
      ...(patch.repoUrl !== undefined ? { repoUrl: String(patch.repoUrl) } : {}),
      ...(patch.description !== undefined
        ? { description: String(patch.description) }
        : {}),
      ...(patch.category !== undefined
        ? { category: String(patch.category) }
        : {}),
      ...(patch.tags !== undefined ? { tags: patch.tags.slice() } : {}),
    };

    rows[idx] = updated;
    this.writeAllRows(rows);

    return {
      ...updated,
      category: updated.category ?? 'Other',
      tags: updated.tags ?? [],
    };
  }
}

export type { CreateProjectRecordInput };
