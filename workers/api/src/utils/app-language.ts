export interface AppLanguage {
  languages: string[];
  source: 'author' | 'detected';
  revision?: string;
  checkedAt?: string;
}

/** App UI languages are deliberately separate from listing localization. */
export function normalizeAppLanguageCode(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(value)) return;
  try {
    const code = Intl.getCanonicalLocales(value)[0]?.split('-')[0].toLowerCase();
    if (!code || code === 'und') return;
    return code;
  } catch {
    return;
  }
}

export function normalizeAppLanguages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(value.map(normalizeAppLanguageCode).filter((code): code is string => !!code)),
  ].slice(0, 8);
}

export function parseAppLanguage(value: unknown): AppLanguage | undefined {
  if (!value || typeof value !== 'object') return;
  const data = value as AppLanguage;
  if (!['author', 'detected'].includes(data.source)) return;
  return {
    languages: normalizeAppLanguages(data.languages),
    source: data.source,
    ...(typeof data.revision === 'string' && { revision: data.revision }),
    ...(typeof data.checkedAt === 'string' && { checkedAt: data.checkedAt }),
  };
}

export function matchesAppLanguages(app: AppLanguage | undefined, requested: string[]): boolean {
  const languages = app?.languages ?? [];
  return requested.some((code) =>
    code === 'und' ? languages.length === 0 : languages.includes(code) || languages.includes('zxx')
  );
}
