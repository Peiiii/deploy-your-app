import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface LegacyProjectRow {
  id: string;
  name: string;
  repo_url: string;
  source_type: string | null;
  url: string | null;
  category: string | null;
  tags: string | null;
}

interface GeneratedMetadata {
  description?: string;
  category?: string;
  tags?: string[];
}

interface BackfillResult {
  project: LegacyProjectRow;
  metadata?: GeneratedMetadata;
  error?: string;
}

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

class ProjectMetadataBackfill {
  private readonly shouldApply = process.argv.includes('--apply');
  private readonly limit: number;
  private readonly apiBase = (
    process.env.GEMIGO_API_BASE ?? 'https://gemigo.io/api/v1'
  ).replace(/\/+$/, '');

  constructor() {
    this.limit = this.readLimit();
  }

  run = async (): Promise<void> => {
    const projects = this.loadCandidates();
    if (projects.length === 0) {
      console.log(JSON.stringify({ mode: this.mode, candidates: 0 }));
      return;
    }

    const results = await this.mapWithConcurrency(projects, 3, (project) =>
      this.generateMetadata(project),
    );
    const ready = results.filter(
      (result): result is BackfillResult & { metadata: GeneratedMetadata } =>
        !!result.metadata,
    );

    if (this.shouldApply && ready.length > 0) {
      this.applyUpdates(ready);
    }

    console.log(
      JSON.stringify(
        {
          mode: this.mode,
          candidates: projects.length,
          ready: ready.length,
          failed: results.length - ready.length,
          samples: ready.slice(0, 5).map(({ project, metadata }) => ({
            id: project.id,
            name: project.name,
            description: metadata.description,
            category: metadata.category,
            tags: metadata.tags,
          })),
          errors: results
            .filter((result) => result.error)
            .slice(0, 10)
            .map(({ project, error }) => ({ id: project.id, error })),
        },
        null,
        2,
      ),
    );

    if (ready.length === 0) {
      throw new Error(
        'No complete AI metadata was generated; no production rows were changed.',
      );
    }
  };

  private get mode(): 'apply' | 'dry-run' {
    return this.shouldApply ? 'apply' : 'dry-run';
  }

  private readLimit = (): number => {
    const argument = process.argv.find((value) => value.startsWith('--limit='));
    const parsed = Number(argument?.slice('--limit='.length) ?? 25);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 500) {
      throw new Error('--limit must be an integer between 1 and 500');
    }
    return parsed;
  };

  private loadCandidates = (): LegacyProjectRow[] => {
    const sql = `
      SELECT id, name, repo_url, source_type, url, category, tags
      FROM projects
      WHERE status = 'Live'
        AND (is_deleted = 0 OR is_deleted IS NULL)
        AND (description IS NULL OR TRIM(description) = '')
      ORDER BY last_deployed DESC
      LIMIT ${this.limit}
    `;
    const output = this.runWrangler(sql);
    const parsed = this.parseWranglerJson(output) as Array<{
      results?: LegacyProjectRow[];
    }>;
    return parsed[0]?.results ?? [];
  };

  private generateMetadata = async (
    project: LegacyProjectRow,
  ): Promise<BackfillResult> => {
    try {
      const htmlContent = await this.fetchDeployedHtml(project.url);
      const response = await fetch(`${this.apiBase}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: project.id,
          name: project.name,
          repoUrl: project.repo_url,
          sourceType: htmlContent ? 'html' : project.source_type ?? 'github',
          htmlContent,
        }),
      });
      const responseText = await response.text();
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      const payload = JSON.parse(responseText) as {
        metadata?: GeneratedMetadata;
      };
      const metadata = this.normalizeMetadata(payload.metadata);
      if (!metadata) {
        throw new Error('AI returned incomplete metadata');
      }
      return { project, metadata };
    } catch (error) {
      return {
        project,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };

  private normalizeMetadata = (
    metadata?: GeneratedMetadata,
  ): GeneratedMetadata | undefined => {
    const description = metadata?.description?.replace(/\s+/g, ' ').trim();
    const category = metadata?.category?.trim();
    const tags = Array.isArray(metadata?.tags)
      ? metadata.tags.map((tag) => tag.trim()).filter(Boolean).slice(0, 5)
      : [];
    if (
      !description ||
      description.length < 20 ||
      !category ||
      category.toLowerCase() === 'other' ||
      tags.length === 0 ||
      /\bis an? (?:web|ai) app.*deployed with gemigo\.?$/i.test(description)
    ) {
      return undefined;
    }
    return { description, category, tags };
  };

  private fetchDeployedHtml = async (
    url: string | null,
  ): Promise<string | undefined> => {
    if (!url) return undefined;
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'GemiGo metadata backfill' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) return undefined;
      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('text/html')) return undefined;
      return (await response.text()).slice(0, 12_000);
    } catch {
      return undefined;
    }
  };

  private applyUpdates = (
    results: Array<BackfillResult & { metadata: GeneratedMetadata }>,
  ): void => {
    for (let index = 0; index < results.length; index += 10) {
      const chunk = results.slice(index, index + 10);
      const sql = chunk
        .map(({ project, metadata }) => this.buildUpdateSql(project, metadata))
        .join('\n');
      this.runWrangler(sql);
    }
  };

  private buildUpdateSql = (
    project: LegacyProjectRow,
    metadata: GeneratedMetadata,
  ): string => {
    const id = this.escapeSql(project.id);
    const description = this.escapeSql(metadata.description ?? '');
    const category = this.escapeSql(metadata.category ?? 'Other');
    const tags = this.escapeSql(JSON.stringify(metadata.tags ?? []));
    return `
      UPDATE projects
      SET description = CASE
            WHEN description IS NULL OR TRIM(description) = '' THEN '${description}'
            ELSE description
          END,
          category = CASE
            WHEN category IS NULL OR TRIM(category) = '' OR LOWER(category) = 'other'
              THEN '${category}'
            ELSE category
          END,
          tags = CASE
            WHEN tags IS NULL OR TRIM(tags) = '' OR tags = '[]' THEN '${tags}'
            ELSE tags
          END
      WHERE id = '${id}';
    `;
  };

  private runWrangler = (sql: string): string =>
    execFileSync(
      'pnpm',
      [
        '--filter',
        'deploy-your-app-api-worker',
        'exec',
        'wrangler',
        'd1',
        'execute',
        'gemigo-projects',
        '--remote',
        '--json',
        '--command',
        sql,
      ],
      {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'inherit'],
      },
    );

  private parseWranglerJson = (output: string): unknown => {
    const start = output.indexOf('[');
    const end = output.lastIndexOf(']');
    if (start < 0 || end < start) {
      throw new Error('Wrangler did not return JSON output');
    }
    return JSON.parse(output.slice(start, end + 1)) as unknown;
  };

  private escapeSql = (value: string): string => value.replaceAll("'", "''");

  private mapWithConcurrency = async <T, R>(
    values: T[],
    concurrency: number,
    mapper: (value: T) => Promise<R>,
  ): Promise<R[]> => {
    const results = new Array<R>(values.length);
    let nextIndex = 0;
    const worker = async (): Promise<void> => {
      while (nextIndex < values.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await mapper(values[index]);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(concurrency, values.length) }, worker),
    );
    return results;
  };
}

await new ProjectMetadataBackfill().run();
