import type { Project } from '../../../common/types.js';
import { SourceType } from '../../../common/types.js';
import type { CloudflareD1Config } from '../../../common/config/configTypes.js';
import type { CreateProjectRecordInput } from './file-project.repository.js';

interface D1QueryResponse {
  success: boolean;
  result?: Array<{
    results?: Array<Record<string, unknown>>;
  }> | Record<string, unknown>;
  errors?: Array<{ message?: string }>;
}

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

export class CloudflareProjectRepository {
  private schemaEnsured = false;
  private endpoint: string;

  constructor(private readonly config: CloudflareD1Config) {
    this.endpoint = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${config.databaseId}/query`;
  }

  private async ensureSchema(): Promise<void> {
    if (this.schemaEnsured) return;
    await this.runQuery(
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
    );
    await this.runQuery(
      `CREATE INDEX IF NOT EXISTS idx_projects_repo_url ON projects(repo_url)`,
    );
    this.schemaEnsured = true;
  }

  private async runQuery(sql: string, params: unknown[] = []): Promise<ProjectRow[]> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiToken}`,
      },
      body: JSON.stringify({ sql, params }),
    });
    const data = (await response.json()) as D1QueryResponse;
    if (!response.ok || !data.success) {
      const message =
        data.errors?.map((err) => err.message).join('; ') ||
        `Cloudflare D1 query failed with status ${response.status}`;
      throw new Error(message);
    }
    const resultSets = Array.isArray(data.result) ? data.result : data.result ? [data.result] : [];
    const rows: ProjectRow[] = [];
    for (const set of resultSets) {
      if (Array.isArray(set?.results)) {
        rows.push(...set.results);
      }
    }
    return rows;
  }

  private mapRowToProject(row: ProjectRow): Project {
    const tags = parseJsonArray<string[]>(row.tags, []);
    const sourceTypeValue = typeof row.source_type === 'string' ? row.source_type : undefined;
    const deployTargetValue =
      typeof row.deploy_target === 'string' ? row.deploy_target : undefined;

    return {
      id: String(row.id),
      name: String(row.name),
      repoUrl: String(row.repo_url),
      sourceType: sourceTypeValue
        ? (sourceTypeValue as SourceType)
        : undefined,
      slug: typeof row.slug === 'string' ? row.slug : undefined,
      analysisId: typeof row.analysis_id === 'string' ? row.analysis_id : undefined,
      lastDeployed: String(row.last_deployed),
      status: (row.status as Project['status']) ?? 'Live',
      url: typeof row.url === 'string' ? row.url : undefined,
      description: typeof row.description === 'string' ? row.description : undefined,
      framework:
        (typeof row.framework === 'string'
          ? (row.framework as Project['framework'])
          : undefined) ?? 'Unknown',
      category: typeof row.category === 'string' ? row.category : undefined,
      tags,
      deployTarget: deployTargetValue
        ? (deployTargetValue as Project['deployTarget'])
        : undefined,
      providerUrl: typeof row.provider_url === 'string' ? row.provider_url : undefined,
      cloudflareProjectName:
        typeof row.cloudflare_project_name === 'string'
          ? row.cloudflare_project_name
          : undefined,
      htmlContent: typeof row.html_content === 'string' ? row.html_content : undefined,
    };
  }

  async createProjectRecord(input: CreateProjectRecordInput): Promise<Project> {
    await this.ensureSchema();
    const rows = await this.runQuery(
      `INSERT INTO projects (
        id, name, repo_url, source_type, slug, analysis_id, last_deployed, status,
        url, description, framework, category, tags, deploy_target, provider_url,
        cloudflare_project_name, html_content
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *`,
      [
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
      ],
    );
    if (rows.length === 0) {
      throw new Error('Failed to insert project into D1.');
    }
    return this.mapRowToProject(rows[0]);
  }

  async getAllProjects(): Promise<Project[]> {
    await this.ensureSchema();
    const rows = await this.runQuery(
      `SELECT * FROM projects ORDER BY datetime(last_deployed) DESC`,
    );
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
      const rows = await this.runQuery(`SELECT * FROM projects WHERE id = ?`, [id]);
      if (rows.length === 0) return null;
      return this.mapRowToProject(rows[0]);
    }

    params.push(id);
    const rows = await this.runQuery(
      `UPDATE projects SET ${statements.join(', ')} WHERE id = ? RETURNING *`,
      params,
    );
    if (rows.length === 0) return null;
    return this.mapRowToProject(rows[0]);
  }
}
