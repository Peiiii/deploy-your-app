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

export interface ProjectQueryOptions {
  search?: string;
  category?: string;
  tag?: string;
  onlyPublic?: boolean;
  ownerId?: string;
  sort?: 'recent' | 'name';
  limit?: number;
  offset?: number;
}

class ProjectRepository {
  private async ensureSchema(db: D1Database): Promise<void> {
    if (schemaEnsured) return;
    await db
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
          html_content TEXT,
          owner_id TEXT,
          is_public INTEGER,
          is_deleted INTEGER
        )`,
      )
      .run();

    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_projects_repo_url ON projects(repo_url)`,
      )
      .run();

    // Backfill owner_id column if the table was created before this field existed.
    try {
      await db
        .prepare(`ALTER TABLE projects ADD COLUMN owner_id TEXT`)
        .run();
    } catch {
      // Ignore error if column already exists.
    }

    // Backfill is_public column for existing databases. We default to 1 (public)
    // so that legacy projects continue to appear in Explore.
    try {
      await db
        .prepare(`ALTER TABLE projects ADD COLUMN is_public INTEGER DEFAULT 1`)
        .run();
    } catch {
      // Ignore error if column already exists.
    }

    try {
      await db
        .prepare(
          `ALTER TABLE projects ADD COLUMN is_deleted INTEGER DEFAULT 0`,
        )
        .run();
    } catch {
      // Ignore error if column already exists.
    }

    // Tombstone table to remember which slugs have ever been used, so that
    // future projects cannot reuse them even after hard deletion.
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS project_slug_tombstones (
          slug TEXT PRIMARY KEY
        )`,
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

    let isPublic: boolean | undefined;
    if (typeof row.is_public === 'number') {
      isPublic = !!row.is_public;
    } else if (typeof row.is_public === 'string') {
      const normalized = row.is_public.toLowerCase();
      isPublic = normalized === '1' || normalized === 'true';
    } else {
      // Legacy rows without this column are treated as public.
      isPublic = true;
    }

    return {
      id: String(row.id),
      ownerId:
        typeof row.owner_id === 'string' ? (row.owner_id as string) : undefined,
      isPublic,
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

  async createProjectRecord(
    db: D1Database,
    input: CreateProjectRecordInput,
  ): Promise<Project> {
    await this.ensureSchema(db);
    const row = await db
      .prepare(
        `INSERT INTO projects (
          id, name, repo_url, source_type, slug, analysis_id, last_deployed, status,
          url, description, framework, category, tags, deploy_target, provider_url,
          cloudflare_project_name, html_content, owner_id, is_public, is_deleted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
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
        input.ownerId ?? null,
        input.isPublic === undefined ? 1 : input.isPublic ? 1 : 0,
      )
      .first<ProjectRow>();

    if (!row) {
      throw new Error('Failed to insert project.');
    }

    return this.mapRowToProject(row);
  }

  async getAllProjects(
    db: D1Database,
    options?: { page?: number; pageSize?: number },
  ): Promise<{ items: Project[]; total: number }> {
    await this.ensureSchema(db);

    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 50;
    const offset = (page - 1) * pageSize;

    // Get total count
    const countResult = await db
      .prepare('SELECT COUNT(*) as count FROM projects')
      .first<{ count: number }>();
    const total = countResult?.count ?? 0;

    // Get paginated results
    const result = await db
      .prepare(
        `SELECT * FROM projects
         ORDER BY datetime(last_deployed) DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(pageSize, offset)
      .all<ProjectRow>();

    const rows = result.results ?? [];
    const items = rows.map((row) => this.mapRowToProject(row));

    return { items, total };
  }

  /**
   * Flexible project query with basic search / filtering / sorting.
   * This is used by the public Explore/Home feeds so that most of the
   * heavy lifting happens in D1 rather than in the frontend.
   */
  async queryProjects(
    db: D1Database,
    options: ProjectQueryOptions,
  ): Promise<Project[]> {
    await this.ensureSchema(db);

    const where: string[] = [];
    const params: unknown[] = [];

    if (options.onlyPublic) {
      where.push('is_public = 1');
    }

    if (options.ownerId) {
      where.push('owner_id = ?');
      params.push(options.ownerId);
    }

    if (options.category) {
      where.push('category = ?');
      params.push(options.category);
    }

    if (options.search) {
      const q = `%${options.search.toLowerCase()}%`;
      where.push(
        `(
          LOWER(name) LIKE ?
          OR LOWER(IFNULL(description, '')) LIKE ?
          OR LOWER(IFNULL(category, '')) LIKE ?
          OR LOWER(IFNULL(tags, '')) LIKE ?
        )`,
      );
      params.push(q, q, q, q);
    }

    if (options.tag) {
      // tags is stored as a JSON array; we approximate tag matching by
      // searching for the tag name inside the JSON string.
      where.push('tags LIKE ?');
      params.push(`%${options.tag}%`);
    }

    let sql = 'SELECT * FROM projects';
    if (where.length > 0) {
      sql += ' WHERE ' + where.join(' AND ');
    }

    const sort = options.sort ?? 'recent';
    if (sort === 'name') {
      sql += ' ORDER BY LOWER(name) ASC';
    } else {
      // Default sort: most recently deployed first.
      sql += ' ORDER BY datetime(last_deployed) DESC';
    }

    if (typeof options.limit === 'number') {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }
    if (typeof options.offset === 'number') {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }

    const stmt = db.prepare(sql);
    const result = await stmt.bind(...params).all<ProjectRow>();
    const rows = result.results ?? [];
    return rows.map((row) => this.mapRowToProject(row));
  }

  async updateProjectRecord(
    db: D1Database,
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
  ): Promise<Project | null> {
    await this.ensureSchema(db);
    const statements: string[] = [];
    const params: unknown[] = [];

    if (patch.name !== undefined) {
      statements.push('name = ?');
      params.push(patch.name);
    }
    if (patch.slug !== undefined) {
      statements.push('slug = ?');
      params.push(patch.slug);
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
    if (patch.isPublic !== undefined) {
      statements.push('is_public = ?');
      params.push(patch.isPublic ? 1 : 0);
    }

    if (statements.length === 0) {
      const row = await db
        .prepare(`SELECT * FROM projects WHERE id = ?`)
        .bind(id)
        .first<ProjectRow>();
      return row ? this.mapRowToProject(row) : null;
    }

    params.push(id);
    const row = await db
      .prepare(
        `UPDATE projects SET ${statements.join(', ')} WHERE id = ? RETURNING *`,
      )
      .bind(...params)
      .first<ProjectRow>();
    return row ? this.mapRowToProject(row) : null;
  }

  async updateProjectDeploymentRecord(
    db: D1Database,
    id: string,
    patch: {
      status?: Project['status'];
      lastDeployed?: string;
      url?: string;
      deployTarget?: Project['deployTarget'];
      providerUrl?: string;
      cloudflareProjectName?: string;
    },
  ): Promise<Project | null> {
    await this.ensureSchema(db);
    const statements: string[] = [];
    const params: unknown[] = [];

    if (patch.status !== undefined) {
      statements.push('status = ?');
      params.push(patch.status);
    }
    if (patch.lastDeployed !== undefined) {
      statements.push('last_deployed = ?');
      params.push(patch.lastDeployed);
    }
    if (patch.url !== undefined) {
      statements.push('url = ?');
      params.push(patch.url);
    }
    if (patch.deployTarget !== undefined) {
      statements.push('deploy_target = ?');
      params.push(patch.deployTarget);
    }
    if (patch.providerUrl !== undefined) {
      statements.push('provider_url = ?');
      params.push(patch.providerUrl);
    }
    if (patch.cloudflareProjectName !== undefined) {
      statements.push('cloudflare_project_name = ?');
      params.push(patch.cloudflareProjectName);
    }

    if (statements.length === 0) {
      const row = await db
        .prepare(`SELECT * FROM projects WHERE id = ?`)
        .bind(id)
        .first<ProjectRow>();
      return row ? this.mapRowToProject(row) : null;
    }

    params.push(id);
    const row = await db
      .prepare(
        `UPDATE projects SET ${statements.join(', ')} WHERE id = ? RETURNING *`,
      )
      .bind(...params)
      .first<ProjectRow>();
    return row ? this.mapRowToProject(row) : null;
  }

  async getProjectById(db: D1Database, id: string): Promise<Project | null> {
    await this.ensureSchema(db);
    const row = await db
      .prepare(
        `SELECT * FROM projects
         WHERE id = ?`,
      )
      .bind(id)
      .first<ProjectRow>();
    return row ? this.mapRowToProject(row) : null;
  }

  /**
   * Find the most recently deployed project for a given repo URL owned by
   * the specified user. This is used to detect when the user is trying to
   * deploy a repository they already have a project for so that the UI can
   * guide them to redeploy instead of creating a conflicting project.
   */
  async findByRepoUrlAndOwner(
    db: D1Database,
    repoUrl: string,
    ownerId: string,
  ): Promise<Project | null> {
    await this.ensureSchema(db);
    const row = await db
      .prepare(
        `SELECT * FROM projects
         WHERE repo_url = ?
           AND owner_id = ?
           AND (is_deleted = 0 OR is_deleted IS NULL)
         ORDER BY datetime(last_deployed) DESC
         LIMIT 1`,
      )
      .bind(repoUrl, ownerId)
      .first<ProjectRow>();

    return row ? this.mapRowToProject(row) : null;
  }

  async slugExists(
    db: D1Database,
    slug: string,
    excludeProjectId?: string,
  ): Promise<boolean> {
    await this.ensureSchema(db);
    const existingProject = await db
      .prepare(
        `SELECT id FROM projects
         WHERE slug = ?
         LIMIT 1`,
      )
      .bind(slug)
      .first<{ id: string }>();

    if (existingProject) {
      if (excludeProjectId && existingProject.id === excludeProjectId) {
        // Still check tombstones below to avoid reusing a retired slug.
      } else {
        return true;
      }
    }

    const tombstone = await db
      .prepare(
        `SELECT slug FROM project_slug_tombstones
         WHERE slug = ?
         LIMIT 1`,
      )
      .bind(slug)
      .first<{ slug: string }>();

    return !!tombstone;
  }

  async recordSlugTombstone(db: D1Database, slug: string): Promise<void> {
    await this.ensureSchema(db);
    await db
      .prepare(
        `INSERT OR IGNORE INTO project_slug_tombstones (slug)
         VALUES (?)`,
      )
      .bind(slug)
      .run();
  }

  async hardDeleteProject(
    db: D1Database,
    id: string,
    ownerId: string,
  ): Promise<boolean> {
    await this.ensureSchema(db);
    const result = await db
      .prepare(
        `DELETE FROM projects
         WHERE id = ? AND owner_id = ?`,
      )
      .bind(id, ownerId)
      .run();

    const meta = (result as unknown as { meta?: { changes?: number } }).meta;
    const changes = meta?.changes ?? 0;
    return changes > 0;
  }
}

export const projectRepository = new ProjectRepository();
