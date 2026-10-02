import type {
  ProjectLocalization,
  ProjectLocalizedFields,
} from '../types/project';

const DEFAULT_FALLBACK_LOCALE = 'en';

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

function normalizeLocalizedFields(
  value: unknown,
): ProjectLocalizedFields | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const input = value as Record<string, unknown>;
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) return undefined;

  const rawDescription =
    typeof input.description === 'string' ? input.description.trim() : '';

  return {
    name,
    ...(rawDescription ? { description: rawDescription } : {}),
  };
}

export function normalizeProjectLocalization(
  value: unknown,
): ProjectLocalization | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const input = value as Record<string, unknown>;
  const defaultLocale =
    typeof input.defaultLocale === 'string'
      ? canonicalizeLocale(input.defaultLocale)
      : '';
  const rawLocales = input.locales;

  if (
    !defaultLocale ||
    !rawLocales ||
    typeof rawLocales !== 'object' ||
    Array.isArray(rawLocales)
  ) {
    return undefined;
  }

  const locales: Record<string, ProjectLocalizedFields> = {};
  for (const [rawLocale, entry] of Object.entries(
    rawLocales as Record<string, unknown>,
  )) {
    const locale = canonicalizeLocale(rawLocale);
    const normalizedEntry = normalizeLocalizedFields(entry);
    if (!locale || !normalizedEntry) continue;
    locales[locale] = normalizedEntry;
  }

  if (!locales[defaultLocale]?.name) {
    return undefined;
  }

  const rawGenerated = input.generatedDescriptions as Record<string, unknown> | undefined;
  const generatedLocales: Record<string, string> = {};
  if (rawGenerated && typeof rawGenerated.source === 'string' && rawGenerated.locales && typeof rawGenerated.locales === 'object') {
    for (const code of ['zh', 'en']) {
      const text = (rawGenerated.locales as Record<string, unknown>)[code];
      if (typeof text === 'string' && text.trim()) generatedLocales[code] = text.trim();
    }
  }
  return {
    defaultLocale,
    locales,
    ...(rawGenerated && typeof rawGenerated.source === 'string' ? {
      generatedDescriptions: {
        source: rawGenerated.source,
        locales: generatedLocales,
        ...(typeof rawGenerated.retryAfter === 'string' ? { retryAfter: rawGenerated.retryAfter } : {}),
      },
    } : {}),
  };
}

export function getDefaultLocalizedFields(
  localization?: ProjectLocalization,
): ProjectLocalizedFields | undefined {
  if (!localization) return undefined;
  return localization.locales[localization.defaultLocale];
}

export function deriveFlatMetadataFromLocalization(
  localization?: ProjectLocalization,
): {
  defaultLocale?: string;
  name?: string;
  description?: string;
} {
  const fields = getDefaultLocalizedFields(localization);
  if (!fields) return {};

  return {
    defaultLocale: localization?.defaultLocale,
    name: fields.name,
    description: fields.description,
  };
}

export function mergeDefaultLocaleIntoLocalization(
  localization: ProjectLocalization | undefined,
  patch: {
    name?: string;
    description?: string;
  },
  fallbackLocale = DEFAULT_FALLBACK_LOCALE,
): ProjectLocalization | undefined {
  if (!localization) return undefined;

  const locale = localization.defaultLocale || fallbackLocale;
  const current = localization.locales[locale];
  if (!current) return localization;

  const name =
    patch.name !== undefined && patch.name.trim().length > 0
      ? patch.name.trim()
      : current.name;
  const description =
    patch.description !== undefined
      ? patch.description?.trim() || undefined
      : current.description;

  return {
    ...localization,
    defaultLocale: locale,
    locales: {
      ...localization.locales,
      [locale]: {
        name,
        ...(description ? { description } : {}),
      },
    },
  };
}
