const DEFAULT_WEB_URL = 'https://gemigo.io';

const normalizeUrl = (value: string): string => {
  const parsed = new URL(value.trim());
  // Avoid trailing slash to keep comparisons stable.
  return parsed.toString().replace(/\/+$/, '');
};

export const getWebUrl = (): string => {
  const raw = process.env.DESKTOP_WEB_URL;
  if (raw && raw.trim().length > 0) {
    try {
      return normalizeUrl(raw);
    } catch (err) {
      console.warn('Invalid DESKTOP_WEB_URL, falling back to default', err);
    }
  }
  return normalizeUrl(DEFAULT_WEB_URL);
};
