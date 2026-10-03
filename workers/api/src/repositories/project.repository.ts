import { addressTakenError, addressLockedError } from '../utils/project-address';
import { DailyProjectLimitError } from '../utils/error-handler';
import { DAILY_PROJECT_LIMIT, projectCreationWindow } from '../utils/project-creation-limit';
import { parseAppLanguage, type AppLanguage } from '../utils/app-language';
import {
  type CreateProjectRecordInput,
  type ProjectLocalization,
  type Project,
  type SourceType,
} from '../types/project';
import {
  normalizeProjectLocalization,
  deriveFlatMetadataFromLocalization,
} from '../utils/project-localization';

import { engagementRepository } from './engagement.repository';
import { analyticsRepository } from './analytics.repository';

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

function parseJsonObject<T>(value: unknown): T | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

let schemaEnsured = false;

export interface ProjectQueryOptions {
  languages?: string[];
  search?: string;
  category?: string;
  tag?: string;
  onlyPublic?: boolean;
  includeDeleted?: boolean;
  isExtensionSupported?: boolean;
  ownerId?: string;
  sort?: 'recent' | 'name';
  limit?: number;
  offset?: number;
}

function projectFilters(options: Omit<ProjectQueryOptions, 'sort'>): { where: string[]; params: unknown[] } {
  const where: string[] = [];
  const params: unknown[] = [];

  if (!options.includeDeleted) {
    where.push('(is_deleted = 0 OR is_deleted IS NULL)');
  }

  if (options.onlyPublic) {
    where.push('is_public = 1');
    // "Public" in product terms means the app is actually accessible.
    // Projects that have never successfully deployed (no live URL) must not
    // appear in public feeds like Explore.
    where.push("status = 'Live'");
    where.push("url IS NOT NULL AND TRIM(url) != ''");
  }

  if (typeof options.isExtensionSupported === 'boolean') {
    where.push('is_extension_supported = ?');
    params.push(options.isExtensionSupported ? 1 : 0);
  }

  if (options.ownerId) {
    where.push('owner_id = ?');
    params.push(options.ownerId);
  }

  if (options.category) {
    if (options.category === 'Other') {
      // Unknown and future categories stay discoverable until the catalog grows.
      where.push("COALESCE(category, '') NOT IN ('Education', 'Games', 'Productivity', 'Creative', 'Development')");
    } else if (options.category === 'Games') {
      where.push(`(category = 'Games' OR (category = 'Education' AND EXISTS (
        SELECT 1 FROM json_each(CASE WHEN json_valid(tags)
          THEN CASE WHEN json_type(tags) = 'array' THEN tags ELSE '[]' END
          ELSE '[]' END)
        WHERE type = 'text' AND lower(value) = 'game'
      )))`);
    } else {
      where.push('category = ?');
      params.push(options.category);
    }
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

  if (options.languages) {
    where.push(`((? = 1 AND COALESCE(json_array_length(json_extract(app_language, '$.languages')), 0) = 0)
      OR EXISTS (SELECT 1 FROM json_each(json_extract(app_language, '$.languages')) AS lang
        WHERE lang.value IN (SELECT value FROM json_each(?)) OR (lang.value = 'zxx' AND ? = 1)))`);
    params.push(options.languages.includes('und') ? 1 : 0, JSON.stringify(options.languages), options.languages.some(code => code !== 'und') ? 1 : 0);
  }

  if (options.tag) {
    // tags is stored as a JSON array; we approximate tag matching by
    // searching for the tag name inside the JSON string.
    where.push('tags LIKE ?');
    params.push(`%${options.tag}%`);
  }
  return { where, params };
}

/** Shared by scheduled runtime and the bounded operational backfill. */
export const DESCRIPTION_TRANSLATION_CANDIDATES_SQL = `SELECT * FROM projects
  WHERE is_public=1 AND status='Live' AND COALESCE(is_deleted,0)=0
    AND url IS NOT NULL AND TRIM(url)!='' AND description IS NOT NULL AND TRIM(description)!=''
    AND (COALESCE(json_extract(localized_metadata,'$.generatedDescriptions.source'),'') <> description
      OR COALESCE(json_extract(localized_metadata,'$.generatedDescriptions.retryAfter'),'') <= ?)
    AND (${['zh', 'en']
      .map(
        (
          code
        ) => `(NOT EXISTS (SELECT 1 FROM json_each(json_extract(localized_metadata,'$.locales'))
      WHERE (LOWER(key)='${code}' OR LOWER(key) LIKE '${code}-%') AND LENGTH(TRIM(COALESCE(json_extract(value,'$.description'),'')))>0)
      AND (COALESCE(json_extract(localized_metadata,'$.generatedDescriptions.source'),'') <> description
        OR COALESCE(json_extract(localized_metadata,'$.generatedDescriptions.locales.${code}'),'')=''))`
      )
      .join(' OR ')})
  ORDER BY last_deployed DESC, id LIMIT ?`;

export function descriptionTranslationWrite(
  project: Pick<Project, 'id' | 'description'>,
  generated: NonNullable<ProjectLocalization['generatedDescriptions']>
): { sql: string; params: string[] } {
  return {
    sql: `UPDATE projects SET localized_metadata=json_set(COALESCE(localized_metadata,json_object('defaultLocale','und','locales',json_object('und',json_object('name',name,'description',description)))), '$.generatedDescriptions',json(?))
      WHERE id=? AND description=? AND is_public=1 AND status='Live' AND COALESCE(is_deleted,0)=0`,
    params: [JSON.stringify(generated), project.id, project.description || ''],
  };
}

class ProjectRepository {
  /** Aggregate and paginate inside D1; never transfer all candidates to the Worker. */
  async queryExplorePage(
    db: D1Database,
    options: Pick<ProjectQueryOptions, 'languages' | 'search' | 'category' | 'tag' | 'isExtensionSupported'> & {
      sort: 'recent' | 'popularity';
      limit: number;
      offset: number;
      fromDateInclusive: string;
    },
  ): Promise<{
    items: Project[];
    total: number;
    availableLanguages: string[];
    engagement: Record<string, { likesCount: number; favoritesCount: number }>; 
  }> {
    await Promise.all([
      this.ensureSchema(db),
      engagementRepository.ensureSchema(db),
      ...(options.sort === 'popularity' ? [analyticsRepository.ensureSchema(db)] : []),
    ]);
    const { where, params } = projectFilters({ ...options, onlyPublic: true });
    const whereSql = where.join(' AND ');
    const popular = options.sort === 'popularity';
    const viewsSql = popular
      ? `, COALESCE((SELECT SUM(human_views) FROM project_daily_stats
          WHERE slug = COALESCE(p.slug, p.id) AND date >= ?), 0) AS explore_views`
      : '';
    const orderSql = `${popular ? 'explore_views DESC, explore_favorites DESC, explore_likes DESC, ' : ''}
      julianday(last_deployed) DESC, last_deployed DESC, id ASC`;
    const catalogFilters = projectFilters({ ...options, languages: undefined, onlyPublic: true });
    const [count, page, languageRows] = await db.batch<ProjectRow>([
      db.prepare(`SELECT COUNT(*) AS total FROM projects WHERE ${whereSql}`).bind(...params),
      db.prepare(`SELECT p.*,
        (SELECT COUNT(*) FROM project_likes WHERE project_id = p.id) AS explore_likes,
        (SELECT COUNT(*) FROM project_favorites WHERE project_id = p.id) AS explore_favorites
        ${viewsSql}
        FROM projects p WHERE ${whereSql}
        ORDER BY ${orderSql} LIMIT ? OFFSET ?`)
        .bind(...(popular ? [options.fromDateInclusive] : []), ...params, options.limit, options.offset),
      db.prepare(`SELECT DISTINCT COALESCE(lang.value, 'und') AS language
        FROM projects LEFT JOIN json_each(json_extract(app_language, '$.languages')) AS lang
        WHERE ${catalogFilters.where.join(' AND ')} ORDER BY language`).bind(...catalogFilters.params),
    ]);
    const rows = (page.results ?? []) as ProjectRow[];
    const engagement: Record<string, { likesCount: number; favoritesCount: number }> = {};
    for (const row of rows) {
      engagement[String(row.id)] = {
        likesCount: Number(row.explore_likes),
        favoritesCount: Number(row.explore_favorites),
      };
    }
    return {
      items: rows.map((row) => this.mapRowToProject(row)),
      total: Number(count.results?.[0]?.total ?? 0),
      availableLanguages: (languageRows.results ?? []).map(row => String(row.language)),
      engagement,
    };
  }

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
          created_at TEXT,
          updated_at TEXT,
          last_success_at TEXT,
          last_deployed TEXT NOT NULL,
          status TEXT NOT NULL,
          url TEXT,
          description TEXT,
          default_locale TEXT,
          localized_metadata TEXT,
          app_language TEXT,
          framework TEXT,
          category TEXT,
          tags TEXT,
          deploy_target TEXT,
          provider_url TEXT,
          cloudflare_project_name TEXT,
          html_content TEXT,
          owner_id TEXT,
          is_public INTEGER,
          is_deleted INTEGER,
          is_extension_supported INTEGER
        )`,
      )
      .run();

    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_projects_repo_url ON projects(repo_url)`,
      )
      .run();

    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id)`,
      )
      .run();

    // Optimize common public feed + profile queries.
    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_projects_public_sort
         ON projects(is_deleted, is_public, status, last_deployed)`,
      )
      .run();

    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_projects_owner_public_sort
         ON projects(owner_id, is_deleted, is_public, status, last_deployed)`,
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

    // Extension surfaces flag: legacy rows default to "not supported".
    try {
      await db
        .prepare(
          `ALTER TABLE projects ADD COLUMN is_extension_supported INTEGER DEFAULT 0`,
        )
        .run();
    } catch {
      // Ignore error if column already exists.
    }

    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_projects_extension_supported ON projects(is_extension_supported)`,
      )
      .run();

    try {
      await db
        .prepare(`ALTER TABLE projects ADD COLUMN default_locale TEXT`)
        .run();
    } catch {
      // Ignore error if column already exists.
    }

    try {
      await db
        .prepare(`ALTER TABLE projects ADD COLUMN localized_metadata TEXT`)
        .run();
    } catch {
      // Ignore error if column already exists.
    }

    for (const column of [
      'app_language TEXT',
      'created_at TEXT',
      'updated_at TEXT',
      'last_success_at TEXT',
    ]) {
      try {
        await db.prepare(`ALTER TABLE projects ADD COLUMN ${column}`).run();
      } catch {
        // Ignore error if column already exists.
      }
    }

    await db
      .prepare(
        `UPDATE projects
         SET created_at = COALESCE(created_at, last_deployed),
             updated_at = COALESCE(updated_at, last_deployed),
             last_success_at = CASE
               WHEN last_success_at IS NULL AND status = 'Live' THEN last_deployed
               ELSE last_success_at
             END
         WHERE created_at IS NULL OR updated_at IS NULL
            OR (last_success_at IS NULL AND status = 'Live')`,
      )
      .run();

    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_projects_owner_created
      ON projects(owner_id, created_at)`).run();

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
    const localization = normalizeProjectLocalization(
      parseJsonObject<ProjectLocalization>(row.localized_metadata),
    );
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

    let isDeleted: boolean | undefined;
    if (typeof row.is_deleted === 'number') {
      isDeleted = !!row.is_deleted;
    } else if (typeof row.is_deleted === 'string') {
      const normalized = row.is_deleted.toLowerCase();
      isDeleted = normalized === '1' || normalized === 'true';
    } else {
      isDeleted = false;
    }

    let isExtensionSupported: boolean | undefined;
    if (typeof row.is_extension_supported === 'number') {
      isExtensionSupported = !!row.is_extension_supported;
    } else if (typeof row.is_extension_supported === 'string') {
      const normalized = row.is_extension_supported.toLowerCase();
      isExtensionSupported = normalized === '1' || normalized === 'true';
    } else {
      isExtensionSupported = false;
    }

    return {
      id: String(row.id),
      ownerId:
        typeof row.owner_id === 'string' ? (row.owner_id as string) : undefined,
      isPublic,
      isDeleted,
      isExtensionSupported,
      name: String(row.name),
      repoUrl: String(row.repo_url),
      sourceType: sourceTypeValue
        ? (sourceTypeValue as SourceType)
        : undefined,
      slug: typeof row.slug === 'string' ? row.slug : undefined,
      analysisId:
        typeof row.analysis_id === 'string' ? row.analysis_id : undefined,
      createdAt:
        typeof row.created_at === 'string' ? row.created_at : undefined,
      updatedAt:
        typeof row.updated_at === 'string' ? row.updated_at : undefined,
      lastSuccessAt:
        typeof row.last_success_at === 'string'
          ? row.last_success_at
          : undefined,
      lastDeployed: String(row.last_deployed),
      status: (row.status as Project['status']) ?? 'Live',
      url: typeof row.url === 'string' ? row.url : undefined,
      description:
        typeof row.description === 'string' ? row.description : undefined,
      defaultLocale:
        typeof row.default_locale === 'string' ? row.default_locale : undefined,
      ...(localization ? { localization } : {}),
      appLanguage: parseAppLanguage(parseJsonObject(row.app_language)),
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

  async assertProjectCreationAllowed(
    db: D1Database,
    ownerId?: string,
    window = projectCreationWindow(),
  ): Promise<void> {
    if (!ownerId) return;
    await this.ensureSchema(db);
    const row = await db.prepare(`SELECT COUNT(*) AS count FROM projects
      WHERE owner_id = ? AND created_at >= ? AND created_at < ?`)
      .bind(ownerId, window.startAt, window.resetAt).first<{ count: number }>();
    if ((row?.count ?? 0) >= DAILY_PROJECT_LIMIT) {
      throw new DailyProjectLimitError(DAILY_PROJECT_LIMIT, window.resetAt);
    }
  }

  async createProjectRecord(
    db: D1Database,
    input: CreateProjectRecordInput,
  ): Promise<Project> {
    await this.ensureSchema(db);
    const window = projectCreationWindow();
    // Stamp user creations at this write boundary, after any metadata work.
    const createdAt = input.ownerId ? window.createdAt : input.createdAt ?? input.lastDeployed;
    const localizedMetadata = normalizeProjectLocalization(input.localization);
    const row = await db
      .prepare(
        `INSERT INTO projects (
          id, name, repo_url, source_type, slug, analysis_id, created_at, updated_at,
          last_success_at, last_deployed, status,
          url, description, default_locale, localized_metadata, framework, category, tags, deploy_target, provider_url,
          cloudflare_project_name, html_content, owner_id, is_public, is_deleted, is_extension_supported
        ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?
        WHERE (? IS NULL OR NOT EXISTS (
          SELECT 1 FROM projects WHERE slug = ? AND (is_deleted = 0 OR is_deleted IS NULL)
        )) AND (? IS NULL OR (
          SELECT COUNT(*) FROM projects
          WHERE owner_id = ? AND created_at >= ? AND created_at < ?
        ) < ?) RETURNING *`,
      )
      .bind(
        input.id,
        input.name,
        input.repoUrl,
        input.sourceType ?? null,
        input.slug ?? null,
        input.analysisId ?? null,
        createdAt,
        input.updatedAt ?? createdAt,
        input.lastSuccessAt ?? null,
        input.lastDeployed,
        input.status,
        input.url ?? null,
        input.description ?? null,
        input.defaultLocale ?? localizedMetadata?.defaultLocale ?? null,
        localizedMetadata ? JSON.stringify(localizedMetadata) : null,
        input.framework,
        input.category ?? null,
        JSON.stringify(input.tags ?? []),
        input.deployTarget ?? null,
        input.providerUrl ?? null,
        input.cloudflareProjectName ?? null,
        input.htmlContent ?? null,
        input.ownerId ?? null,
        input.isPublic === undefined ? 1 : input.isPublic ? 1 : 0,
        input.isExtensionSupported ? 1 : 0,
        input.slug ?? null,
        input.slug ?? null,
        input.ownerId ?? null,
        input.ownerId ?? null,
        window.startAt,
        window.resetAt,
        DAILY_PROJECT_LIMIT,
      )
      .first<ProjectRow>();

    if (!row) {
      await this.assertProjectCreationAllowed(db, input.ownerId, window);
      throw addressTakenError();
    }

    return this.mapRowToProject(row);
  }

  async getAllProjects(
    db: D1Database,
    options?: { page?: number; pageSize?: number; includeDeleted?: boolean },
  ): Promise<{ items: Project[]; total: number }> {
    await this.ensureSchema(db);

    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 50;
    const offset = (page - 1) * pageSize;
    const includeDeleted = options?.includeDeleted ?? false;

    const where = includeDeleted ? '' : 'WHERE (is_deleted = 0 OR is_deleted IS NULL)';

    // Get total count
    const countResult = await db
      .prepare(`SELECT COUNT(*) as count FROM projects ${where}`)
      .first<{ count: number }>();
    const total = countResult?.count ?? 0;

    // Get paginated results
    const result = await db
      .prepare(
        `SELECT * FROM projects
         ${where}
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

    const { where, params } = projectFilters(options);

    let sql = 'SELECT * FROM projects';
    if (where.length > 0) {
      sql += ' WHERE ' + where.join(' AND ');
    }

    const sort = options.sort ?? 'recent';
    if (sort === 'name') {
      sql += ' ORDER BY LOWER(name) ASC';
    } else {
      // Default sort: most recently deployed first.
      // `last_deployed` is ISO-8601, so lexical order matches time order and can use indexes.
      sql += ' ORDER BY last_deployed DESC';
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

  /** Bounded public feed projection: reuse directory filters without shipping HTML/source. */
  async queryPublicFeedItems(db: D1Database, options: ProjectQueryOptions, ids?: string[]): Promise<Project[]> {
    await this.ensureSchema(db);
    await engagementRepository.ensureSchema(db);
    if (ids && !ids.length) return [];
    const { where, params } = projectFilters({ ...options, onlyPublic:true });
    if (ids) { where.push('id IN (SELECT value FROM json_each(?))'); params.push(JSON.stringify(ids)); }
    const columns = `id,name,description,category,tags,url,slug,owner_id,repo_url,source_type,last_deployed,last_success_at,
      status,is_public,is_deleted,app_language,default_locale,localized_metadata`;
    const result = await db.prepare(`SELECT ${columns} FROM projects WHERE ${where.join(' AND ')}
      ORDER BY last_deployed DESC,id ASC LIMIT 1500`).bind(...params).all<ProjectRow>();
    return (result.results || []).map(row => this.mapRowToProject(row));
  }

  async queryProjectsWithCount(
    db: D1Database,
    options: {
      ids?: string[];
      search?: string;
      includeDeleted?: boolean;
      ownerId?: string;
      page?: number;
      pageSize?: number;
    },
  ): Promise<{ items: Project[]; total: number }> {
    await this.ensureSchema(db);

    const where: string[] = [];
    const params: unknown[] = [];

    if (!options.includeDeleted) {
      where.push('(is_deleted = 0 OR is_deleted IS NULL)');
    }

    if (options.ownerId) {
      where.push('owner_id = ?');
      params.push(options.ownerId);
    }

    if (options.ids) {
      where.push('id IN (SELECT value FROM json_each(?))');
      params.push(JSON.stringify(options.ids));
    }

    if (options.search) {
      const q = `%${options.search.toLowerCase()}%`;
      where.push(
        `(LOWER(name) LIKE ? OR LOWER(IFNULL(slug, '')) LIKE ? OR LOWER(repo_url) LIKE ? OR id LIKE ?)`,
      );
      params.push(q, q, q, `%${options.search}%`);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countRow = await db
      .prepare(`SELECT COUNT(*) as count FROM projects ${whereSql}`)
      .bind(...params)
      .first<{ count: number }>();
    const total = countRow?.count ?? 0;

    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.max(1, options.pageSize ?? 50);
    const offset = (page - 1) * pageSize;

    const result = await db
      .prepare(
        `SELECT * FROM projects
         ${whereSql}
         ORDER BY datetime(last_deployed) DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(...params, pageSize, offset)
      .all<ProjectRow>();

    const rows = result.results ?? [];
    return { items: rows.map((row) => this.mapRowToProject(row)), total };
  }

  async descriptionTranslationCandidates(db: D1Database, limit = 3): Promise<Project[]> {
    await this.ensureSchema(db);
    const result = await db
      .prepare(DESCRIPTION_TRANSLATION_CANDIDATES_SQL)
      .bind(new Date().toISOString(), limit)
      .all<ProjectRow>();
    return (result.results ?? []).map((row) => this.mapRowToProject(row));
  }

  async saveDescriptionTranslations(
    db: D1Database,
    project: Project,
    generated: NonNullable<ProjectLocalization['generatedDescriptions']>
  ): Promise<void> {
    await this.ensureSchema(db);
    const write = descriptionTranslationWrite(project, generated);
    await db
      .prepare(write.sql)
      .bind(...write.params)
      .run();
  }

  async languageScanCandidates(db: D1Database, limit = 3): Promise<Project[]> {
    await this.ensureSchema(db);
    const result = await db.prepare(`SELECT * FROM projects
      WHERE status = 'Live' AND url IS NOT NULL AND last_success_at IS NOT NULL
        AND COALESCE(is_deleted, 0) = 0 AND COALESCE(is_public, 1) = 1
        AND (app_language IS NULL OR (COALESCE(json_extract(app_language, '$.source'), '') <> 'author'
          AND COALESCE(json_extract(app_language, '$.revision'), '') <> last_success_at))
        AND (COALESCE(json_extract(app_language, '$.retryRevision'), '') <> last_success_at
          OR COALESCE(json_extract(app_language, '$.retryAfter'), '') <= ?)
      ORDER BY last_success_at DESC LIMIT ?`).bind(new Date().toISOString(), limit).all<ProjectRow>();
    return (result.results ?? []).map(row => this.mapRowToProject(row));
  }

  async saveDetectedLanguage(db: D1Database, project: Project, appLanguage: AppLanguage): Promise<void> {
    await this.ensureSchema(db);
    await db.prepare(`UPDATE projects SET app_language = ?
      WHERE id = ? AND last_success_at = ? AND status = 'Live'
        AND COALESCE(is_deleted, 0) = 0 AND COALESCE(is_public, 1) = 1
        AND (app_language IS NULL OR COALESCE(json_extract(app_language, '$.source'), '') <> 'author')`)
      .bind(JSON.stringify(appLanguage), project.id, project.lastSuccessAt).run();
  }

  /** Failed infrastructure scans back off without classifying or completing a release. */
  async deferLanguageScan(db: D1Database, project: Project): Promise<void> {
    await this.ensureSchema(db);
    await db.prepare(`UPDATE projects SET app_language = json_set(COALESCE(app_language, '{}'),
      '$.retryRevision', ?, '$.retryAfter', ?)
      WHERE id = ? AND last_success_at = ? AND status = 'Live'
        AND COALESCE(is_deleted, 0) = 0 AND COALESCE(is_public, 1) = 1
        AND COALESCE(json_extract(app_language, '$.source'), '') <> 'author'`)
      .bind(project.lastSuccessAt, new Date(Date.now() + 5 * 60_000).toISOString(), project.id, project.lastSuccessAt).run();
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
      localization?: ProjectLocalization;
      appLanguage?: AppLanguage | null;
      isPublic?: boolean;
      isExtensionSupported?: boolean;
      sourceType?: SourceType;
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
    if (patch.localization !== undefined) {
      const localization = normalizeProjectLocalization(patch.localization);
      const localizedFlat = deriveFlatMetadataFromLocalization(localization);
      statements.push('default_locale = ?');
      params.push(localization?.defaultLocale ?? null);
      statements.push('localized_metadata = ?');
      params.push(localization ? JSON.stringify(localization) : null);
      if (localizedFlat.name !== undefined && patch.name === undefined) {
        statements.push('name = ?');
        params.push(localizedFlat.name);
      }
      if (
        localizedFlat.description !== undefined &&
        patch.description === undefined
      ) {
        statements.push('description = ?');
        params.push(localizedFlat.description);
      }
    }
    if (patch.appLanguage !== undefined) {
      statements.push('app_language = ?');
      params.push(patch.appLanguage ? JSON.stringify(patch.appLanguage) : null);
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
    if (patch.isExtensionSupported !== undefined) {
      statements.push('is_extension_supported = ?');
      params.push(patch.isExtensionSupported ? 1 : 0);
    }
    if (patch.sourceType !== undefined) {
      statements.push('source_type = ?');
      params.push(patch.sourceType);
    }

    if (statements.length > 0) {
      statements.push('updated_at = ?');
      params.push(new Date().toISOString());
    }

    if (statements.length === 0) {
      const row = await db
        .prepare(`SELECT * FROM projects WHERE id = ?`)
        .bind(id)
        .first<ProjectRow>();
      return row ? this.mapRowToProject(row) : null;
    }

    params.push(id);
    const slugGuard = patch.slug !== undefined
      ? ` AND NOT EXISTS (SELECT 1 FROM projects WHERE slug = ? AND id <> ? AND (is_deleted = 0 OR is_deleted IS NULL))
          AND (slug = ? OR slug IS NULL OR slug = '' OR
            (status NOT IN ('Live', 'Building') AND (url IS NULL OR url = '') AND last_success_at IS NULL))`
      : '';
    if (patch.slug !== undefined) params.push(patch.slug, id, patch.slug);
    const row = await db
      .prepare(
        `UPDATE projects SET ${statements.join(', ')} WHERE id = ?${slugGuard} RETURNING *`,
      )
      .bind(...params)
      .first<ProjectRow>();
    if (!row && patch.slug !== undefined) {
      const current = await this.getProjectById(db, id);
      if (current) {
        if (current.slug && current.slug !== patch.slug && (current.url || current.lastSuccessAt || current.status === 'Live' || current.status === 'Building')) throw addressLockedError();
        throw addressTakenError();
      }
    }
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
      sourceType?: SourceType;
    },
    expectedAttemptId?: string,
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
    if (patch.sourceType !== undefined) {
      statements.push('source_type = ?');
      params.push(patch.sourceType);
    }

    if (statements.length > 0) {
      const now = new Date().toISOString();
      statements.push('updated_at = ?');
      params.push(now);
      if (patch.status === 'Live') {
        const successAt = patch.lastDeployed ?? now;
        statements.push('last_success_at = ?');
        params.push(successAt);
        if (patch.lastDeployed === undefined) {
          statements.push('last_deployed = ?');
          params.push(successAt);
        }
      }
    }

    if (statements.length === 0) {
      const row = await db
        .prepare(`SELECT * FROM projects WHERE id = ?`)
        .bind(id)
        .first<ProjectRow>();
      return row ? this.mapRowToProject(row) : null;
    }

    params.push(id);
    const condition = expectedAttemptId ? ' AND ? = (SELECT id FROM deployment_attempts WHERE project_id = projects.id ORDER BY started_at DESC, rowid DESC LIMIT 1)' : '';
    if (expectedAttemptId) params.push(expectedAttemptId);
    const row = await db
      .prepare(
        `UPDATE projects SET ${statements.join(', ')} WHERE id = ?${condition} RETURNING *`,
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
         WHERE id = ?
           AND (is_deleted = 0 OR is_deleted IS NULL)`,
      )
      .bind(id)
      .first<ProjectRow>();
    return row ? this.mapRowToProject(row) : null;
  }

  async getProjectByIdIncludingDeleted(
    db: D1Database,
    id: string,
  ): Promise<Project | null> {
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

  async softDeleteProject(db: D1Database, id: string): Promise<boolean> {
    await this.ensureSchema(db);
    const result = await db
      .prepare(
        `UPDATE projects
         SET is_deleted = 1, is_public = 0
         WHERE id = ?`,
      )
      .bind(id)
      .run();
    const meta = (result as unknown as { meta?: { changes?: number } }).meta;
    return (meta?.changes ?? 0) > 0;
  }

  async restoreProject(db: D1Database, id: string): Promise<boolean> {
    await this.ensureSchema(db);
    const result = await db
      .prepare(
        `UPDATE projects
         SET is_deleted = 0
         WHERE id = ?`,
      )
      .bind(id)
      .run();
    const meta = (result as unknown as { meta?: { changes?: number } }).meta;
    return (meta?.changes ?? 0) > 0;
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

  async getOccupiedSlugs(
    db: D1Database,
    baseSlug: string,
    excludeProjectId?: string,
    requestedSlug = baseSlug,
  ): Promise<Set<string>> {
    await this.ensureSchema(db);
    // Read the whole numeric candidate range once instead of a D1 round trip per suffix.
    const { results } = await db.prepare(
      `SELECT DISTINCT slug FROM projects
       WHERE (slug = ? OR slug = ? OR (substr(slug, 1, ?) = ? AND substr(slug, ?, 1) BETWEEN '0' AND '9' AND length(slug) <= ?))
       AND (is_deleted = 0 OR is_deleted IS NULL)
       AND (? IS NULL OR id <> ?)`,
    ).bind(
      requestedSlug, baseSlug, baseSlug.length + 1, `${baseSlug}-`, baseSlug.length + 2, baseSlug.length + 6,
      excludeProjectId ?? null, excludeProjectId ?? null,
    ).all<{ slug: string }>();
    return new Set(results.map((row) => row.slug));
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
         AND (is_deleted = 0 OR is_deleted IS NULL)
         AND (? IS NULL OR id <> ?)
         LIMIT 1`,
      )
      .bind(slug, excludeProjectId ?? null, excludeProjectId ?? null)
      .first<{ id: string }>();

    if (existingProject) {
      return true;
    }

    return false;
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
