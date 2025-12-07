import {
  type CreateProjectRecordInput,
  type Project,
  type SourceType,
} from '../types/project';

type ProjectRow = Record<string, unknown>;

function parseJsonArray<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

let schemaEnsured = false;

export class ProjectRepository {
  constructor(private readonly db: D1Database) {}

  private async ensureSchema(): Promise<void> {
    if (schemaEnsured) return;
    await this.db
      .prepare(
        `CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          repo_url TEXT NOT NULL,
          source_type TEXT,
          slug TEXT,
          analysis_id TEXT,
          last_deployed TEXT NOT NULL,
          status TEXT NOT NULL,
          url TEXT,
          description TEXT,
          framework TEXT,
          category TEXT,
          tags TEXT,
          deploy_target TEXT,
          provider_url TEXT,
          cloudflare_project_name TEXT,
          html_content TEXT
        )`,
      )
      .run();

    await this.db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_projects_repo_url ON projects(repo_url)`,
      )
      .run();

    schemaEnsured = true;
  }

  private mapRowToProject(row: ProjectRow): Project {
    const tags = parseJsonArray<string[]>(row.tags, []);
    const sourceTypeValue =
      typeof row.source_type === 'string'
        ? (row.source_type as string)
        : undefined;

    return {
      id: String(row.id),
      name: String(row.name),
      repoUrl: String(row.repo_url),
      sourceType: sourceTypeValue
        ? (sourceTypeValue as SourceType)
        : undefined,
      slug: typeof row.slug === 'string' ? row.slug : undefined,
      analysisId:
        typeof row.analysis_id === 'string' ? row.analysis_id : undefined,
      lastDeployed: String(row.last_deployed),
      status: (row.status as Project['status']) ?? 'Live',
      url: typeof row.url === 'string' ? row.url : undefined,
      description:
        typeof row.description === 'string' ? row.description : undefined,
      framework:
        (typeof row.framework === 'string'
          ? (row.framework as Project['framework'])
          : undefined) ?? 'Unknown',
      category:
        typeof row.category === 'string' ? row.category : undefined,
      tags,
      deployTarget:
        typeof row.deploy_target === 'string'
          ? (row.deploy_target as Project['deployTarget'])
          : undefined,
      providerUrl:
        typeof row.provider_url === 'string'
          ? row.provider_url
          : undefined,
      cloudflareProjectName:
        typeof row.cloudflare_project_name === 'string'
          ? row.cloudflare_project_name
          : undefined,
      htmlContent:
        typeof row.html_content === 'string' ? row.html_content : undefined,
    };
  }

  async createProjectRecord(input: CreateProjectRecordInput): Promise<Project> {
    await this.ensureSchema();
    const row = await this.db
      .prepare(
        `INSERT INTO projects (
          id, name, repo_url, source_type, slug, analysis_id, last_deployed, status,
          url, description, framework, category, tags, deploy_target, provider_url,
          cloudflare_project_name, html_content
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *`,
      )
      .bind(
        input.id,
        input.name,
        input.repoUrl,
        input.sourceType ?? null,
        input.slug ?? null,
        input.analysisId ?? null,
        input.lastDeployed,
        input.status,
        input.url ?? null,
        input.description ?? null,
        input.framework,
        input.category ?? null,
        JSON.stringify(input.tags ?? []),
        input.deployTarget ?? null,
        input.providerUrl ?? null,
        input.cloudflareProjectName ?? null,
        input.htmlContent ?? null,
      )
      .first<ProjectRow>();

    if (!row) {
      throw new Error('Failed to insert project.');
    }

    return this.mapRowToProject(row);
  }

  async getAllProjects(): Promise<Project[]> {
    await this.ensureSchema();
    const result = await this.db
      .prepare(`SELECT * FROM projects ORDER BY datetime(last_deployed) DESC`)
      .all<ProjectRow>();
    const rows = result.results ?? [];
    return rows.map((row) => this.mapRowToProject(row));
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
    await this.ensureSchema();
    const statements: string[] = [];
    const params: unknown[] = [];

    if (patch.name !== undefined) {
      statements.push('name = ?');
      params.push(patch.name);
    }
    if (patch.repoUrl !== undefined) {
      statements.push('repo_url = ?');
      params.push(patch.repoUrl);
    }
    if (patch.description !== undefined) {
      statements.push('description = ?');
      params.push(patch.description);
    }
    if (patch.category !== undefined) {
      statements.push('category = ?');
      params.push(patch.category);
    }
    if (patch.tags !== undefined) {
      statements.push('tags = ?');
      params.push(JSON.stringify(patch.tags));
    }

    if (statements.length === 0) {
      const row = await this.db
        .prepare(`SELECT * FROM projects WHERE id = ?`)
        .bind(id)
        .first<ProjectRow>();
      return row ? this.mapRowToProject(row) : null;
    }

    params.push(id);
    const row = await this.db
      .prepare(
        `UPDATE projects SET ${statements.join(', ')} WHERE id = ? RETURNING *`,
      )
      .bind(...params)
      .first<ProjectRow>();
    return row ? this.mapRowToProject(row) : null;
  }
}
