import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type {
  GemigoManifest,
  GemigoManifestFile,
  ManifestLocaleEntry,
} from './types.js';

const MANIFEST_SCHEMA_URL = 'https://gemigo.io/schema/gemigo.app.schema.json';

function canonicalizeLocale(rawLocale: string): string {
  const trimmed = rawLocale.trim();
  if (!trimmed) return '';

  try {
    const [canonical] = Intl.getCanonicalLocales(trimmed);
    return canonical ?? trimmed;
  } catch {
    return trimmed;
  }
}

function normalizeLocaleEntry(value: unknown): ManifestLocaleEntry | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const input = value as Record<string, unknown>;
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) return undefined;

  const description =
    typeof input.description === 'string' && input.description.trim().length > 0
      ? input.description.trim()
      : undefined;

  return {
    name,
    ...(description ? { description } : {}),
  };
}

function readRequiredString(
  value: unknown,
  fieldName: string,
  errors: string[],
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push(`${fieldName} must be a non-empty string.`);
    return '';
  }
  return value.trim();
}

function readRequiredTags(value: unknown, errors: string[]): string[] {
  if (!Array.isArray(value)) {
    errors.push('tags must be an array of 1 to 5 non-empty strings.');
    return [];
  }

  const tags = value
    .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
    .filter((tag) => tag.length > 0);

  if (tags.length === 0) {
    errors.push('tags must contain at least one non-empty tag.');
  }
  if (tags.length > 5) {
    errors.push('tags must contain no more than 5 tags.');
  }

  return tags.slice(0, 5);
}

export function parseManifest(input: unknown): GemigoManifest {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Manifest must be a JSON object.');
  }

  const errors: string[] = [];
  const raw = input as Record<string, unknown>;
  const rawDefaultLocale = readRequiredString(
    raw.defaultLocale,
    'defaultLocale',
    errors,
  );
  const defaultLocale = canonicalizeLocale(rawDefaultLocale);
  if (rawDefaultLocale && !defaultLocale) {
    errors.push('defaultLocale must be a valid locale identifier.');
  }

  const rawLocales = raw.locales;
  if (!rawLocales || typeof rawLocales !== 'object' || Array.isArray(rawLocales)) {
    errors.push('locales must be an object keyed by locale.');
  }

  const locales: Record<string, ManifestLocaleEntry> = {};
  if (rawLocales && typeof rawLocales === 'object' && !Array.isArray(rawLocales)) {
    for (const [rawLocale, value] of Object.entries(
      rawLocales as Record<string, unknown>,
    )) {
      const locale = canonicalizeLocale(rawLocale);
      const entry = normalizeLocaleEntry(value);
      if (!locale) {
        errors.push(`locales.${rawLocale} must be a valid locale identifier.`);
        continue;
      }
      if (!entry) {
        errors.push(`locales.${rawLocale}.name must be a non-empty string.`);
        continue;
      }
      if (!entry.description?.trim()) {
        errors.push(`locales.${rawLocale}.description must be a non-empty string.`);
      }
      locales[locale] = entry;
    }
  }

  const defaultEntry = locales[defaultLocale];
  if (!defaultEntry) {
    errors.push(
      'locales must include an entry for defaultLocale with a non-empty name.',
    );
  } else if (!defaultEntry.description?.trim()) {
    errors.push(
      'locales[defaultLocale].description must be a non-empty string.',
    );
  }

  const visibilityRaw = raw.visibility;
  if (visibilityRaw !== 'public' && visibilityRaw !== 'private') {
    errors.push('visibility must be either "public" or "private".');
  }
  const visibility = visibilityRaw === 'private' ? 'private' : 'public';

  const slug =
    typeof raw.slug === 'string' && raw.slug.trim().length > 0
      ? raw.slug.trim()
      : undefined;
  const sourceDir =
    typeof raw.sourceDir === 'string' && raw.sourceDir.trim().length > 0
      ? raw.sourceDir.trim()
      : undefined;

  const category = readRequiredString(raw.category, 'category', errors);
  const tags = readRequiredTags(raw.tags, errors);

  if (errors.length > 0) {
    throw new Error(`Invalid gemigo.app.json:\n- ${errors.join('\n- ')}`);
  }

  return {
    ...(sourceDir ? { sourceDir } : {}),
    ...(slug ? { slug } : {}),
    visibility,
    category,
    tags,
    defaultLocale,
    locales,
  };
}

export async function loadManifest(
  configPath: string,
): Promise<GemigoManifest> {
  const fileContents = await fs.readFile(configPath, 'utf8');
  const parsed = JSON.parse(fileContents) as unknown;
  return parseManifest(parsed);
}

export async function resolveManifestPath(
  cwd: string,
  configPath?: string,
): Promise<string> {
  if (configPath) {
    return path.resolve(cwd, configPath);
  }

  const defaultPath = path.resolve(cwd, 'gemigo.app.json');
  await fs.access(defaultPath);
  return defaultPath;
}

export function createManifestTemplate(input: {
  sourceDir: string;
  name: string;
  description?: string;
  slug?: string;
  visibility?: 'public' | 'private';
  category?: string;
  tags?: string[];
  defaultLocale?: string;
}): GemigoManifestFile {
  const name = input.name.trim();
  const defaultLocale = canonicalizeLocale(input.defaultLocale ?? 'en') || 'en';
  const description =
    input.description?.trim() || 'A static app published to GemiGo.';
  const tags = (input.tags ?? ['static'])
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
    .slice(0, 5);

  return {
    $schema: MANIFEST_SCHEMA_URL,
    sourceDir: input.sourceDir,
    ...(input.slug?.trim() ? { slug: input.slug.trim() } : {}),
    visibility: input.visibility ?? 'public',
    category: input.category?.trim() || 'Tools',
    tags: tags.length > 0 ? tags : ['static'],
    defaultLocale,
    locales: {
      [defaultLocale]: {
        name: name || 'My Static App',
        description,
      },
    },
  };
}

export async function writeManifestTemplate(options: {
  cwd: string;
  dir: string;
  configPath?: string;
  force?: boolean;
  name?: string;
  description?: string;
  slug?: string;
  visibility?: 'public' | 'private';
  category?: string;
  tags?: string[];
  defaultLocale?: string;
}): Promise<{ manifestPath: string; manifest: GemigoManifestFile }> {
  const sourceDir = path.resolve(options.cwd, options.dir);
  const manifestPath = path.resolve(
    options.cwd,
    options.configPath ?? 'gemigo.app.json',
  );
  const manifestDir = path.dirname(manifestPath);
  const existing = await fs
    .access(manifestPath)
    .then(() => true)
    .catch(() => false);
  if (existing && !options.force) {
    throw new Error(
      `Manifest already exists: ${manifestPath}. Pass --force to overwrite it.`,
    );
  }

  const relativeSourceDir = path.relative(manifestDir, sourceDir) || '.';
  const manifest = createManifestTemplate({
    sourceDir: relativeSourceDir.startsWith('.')
      ? relativeSourceDir
      : `./${relativeSourceDir}`,
    name: options.name ?? path.basename(sourceDir),
    description: options.description,
    slug: options.slug,
    visibility: options.visibility,
    category: options.category,
    tags: options.tags,
    defaultLocale: options.defaultLocale,
  });

  await fs.mkdir(manifestDir, { recursive: true });
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return { manifestPath, manifest };
}
