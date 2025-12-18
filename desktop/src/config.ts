const DEFAULT_WEB_URL = 'https://gemigo.io';
const DESKTOP_SCHEME = 'gemigo-desktop';
const DESKTOP_CALLBACK_PATH = 'auth';

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

export const getWebOrigin = (): string => new URL(getWebUrl()).origin;

export const getDesktopEntryUrl = (): string => {
  const url = new URL(getWebUrl());
  url.searchParams.set('desktop', '1');
  return url.toString();
};

export const getDesktopProtocol = (): string => DESKTOP_SCHEME;

export const getDesktopCallbackUrl = (): string =>
  `${DESKTOP_SCHEME}://${DESKTOP_CALLBACK_PATH}`;
