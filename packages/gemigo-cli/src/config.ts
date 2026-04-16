import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { GemigoManifest, ManifestLocaleEntry } from './types.js';

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

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }
  return value.trim();
}

function requireTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error('tags must be an array of strings.');
  }

  const tags = value
    .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
    .filter((tag) => tag.length > 0);

  if (tags.length === 0) {
    throw new Error('tags must contain at least one tag.');
  }

  return tags.slice(0, 5);
}

export function parseManifest(input: unknown): GemigoManifest {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Manifest must be a JSON object.');
  }

  const raw = input as Record<string, unknown>;
  const rawDefaultLocale = requireString(raw.defaultLocale, 'defaultLocale');
  const defaultLocale = canonicalizeLocale(rawDefaultLocale);
  if (!defaultLocale) {
    throw new Error('defaultLocale must be a valid locale identifier.');
  }

  const rawLocales = raw.locales;
  if (!rawLocales || typeof rawLocales !== 'object' || Array.isArray(rawLocales)) {
    throw new Error('locales must be an object keyed by locale.');
  }

  const locales: Record<string, ManifestLocaleEntry> = {};
  for (const [rawLocale, value] of Object.entries(
    rawLocales as Record<string, unknown>,
  )) {
    const locale = canonicalizeLocale(rawLocale);
    const entry = normalizeLocaleEntry(value);
    if (!locale || !entry) continue;
    locales[locale] = entry;
  }

  const defaultEntry = locales[defaultLocale];
  if (!defaultEntry) {
    throw new Error(
      'locales must include an entry for defaultLocale with a non-empty name.',
    );
  }
  if (!defaultEntry.description?.trim()) {
    throw new Error(
      'The default locale entry must include a non-empty description.',
    );
  }

  const visibilityRaw =
    raw.visibility === undefined ? 'public' : raw.visibility;
  if (visibilityRaw !== 'public' && visibilityRaw !== 'private') {
    throw new Error('visibility must be either "public" or "private".');
  }

  const slug =
    typeof raw.slug === 'string' && raw.slug.trim().length > 0
      ? raw.slug.trim()
      : undefined;
  const sourceDir =
    typeof raw.sourceDir === 'string' && raw.sourceDir.trim().length > 0
      ? raw.sourceDir.trim()
      : undefined;

  return {
    ...(sourceDir ? { sourceDir } : {}),
    ...(slug ? { slug } : {}),
    visibility: visibilityRaw,
    category: requireString(raw.category, 'category'),
    tags: requireTags(raw.tags),
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
