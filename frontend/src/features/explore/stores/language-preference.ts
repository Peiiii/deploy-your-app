export const APP_LANGUAGE_KEY = 'gemigo.appLanguages.v1';

export function languageCode(value: unknown): string | undefined {
  if (typeof value !== 'string') return;
  try {
    const code = Intl.getCanonicalLocales(value)[0]?.split('-')[0].toLowerCase();
    return code && /^[a-z]{2,3}$/.test(code) ? code : undefined;
  } catch {
    return;
  }
}

export function browserAppLanguages(languages: readonly string[]): string[] {
  for (const value of languages) {
    const code = languageCode(value);
    if (code && code !== 'und' && code !== 'zxx') return [code];
  }
  return ['en'];
}

export function readLanguagePreference(
  storage: Pick<Storage, 'getItem'> | undefined,
  browserLanguages: readonly string[]
): { languages: string[] | null; automatic: boolean } {
  try {
    const saved = JSON.parse(storage?.getItem(APP_LANGUAGE_KEY) || 'null') as {
      languages?: unknown;
    } | null;
    if (saved && saved.languages === null) return { languages: null, automatic: false };
    if (
      saved &&
      Array.isArray(saved.languages) &&
      saved.languages.length > 0 &&
      saved.languages.length <= 8 &&
      saved.languages.every((code) => typeof code === 'string' && languageCode(code) === code)
    ) {
      return { languages: [...new Set(saved.languages)] as string[], automatic: false };
    }
  } catch {
    /* Browser storage can be blocked. Automatic remains usable. */
  }
  return { languages: browserAppLanguages(browserLanguages), automatic: true };
}

const ENDONYMS: Record<string, string> = {
  zh: '中文',
  en: 'English',
  th: 'ไทย',
  ja: '日本語',
  ko: '한국어',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  pt: 'Português',
  ru: 'Русский',
  ar: 'العربية',
  hi: 'हिन्दी',
  vi: 'Tiếng Việt',
  id: 'Bahasa Indonesia',
};

export function appLanguageLabel(code: string): string {
  if (ENDONYMS[code]) return ENDONYMS[code];
  try {
    return new Intl.DisplayNames([code], { type: 'language' }).of(code) || code;
  } catch {
    return code;
  }
}
