import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// .env loading utilities
// ---------------------------------------------------------------------------

/**
 * Load key=value pairs from a .env file into process.env.
 * - Only fills keys that don't already exist (so real env vars win).
 * - Supports comments and inline comments with '#'.
 * - Best-effort: failures are swallowed so the server can still start.
 */
export function loadDotEnv(envFilePath: string): void {
  let content: string;
  try {
    content = fs.readFileSync(envFilePath, 'utf8');
  } catch {
    // No .env present or unreadable – silently ignore.
    return;
  }

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let rawValue = trimmed.slice(eqIndex + 1);

    // Strip inline comments after '#'
    const hashIndex = rawValue.indexOf('#');
    if (hashIndex !== -1) {
      rawValue = rawValue.slice(0, hashIndex);
    }

    const value = rawValue.trim();
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

// When running from TS sources, __dirname is "<root>/server".
// When running from compiled JS, __dirname is "<root>/server/dist".
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRootDir =
  __dirname.endsWith('dist') ? path.resolve(__dirname, '..') : __dirname;

/**
 * Load the backend's default .env file from the server package root
 * ("server/.env"). This works both when running from TS sources and from
 * compiled JS.
 */
export function loadBackendEnv(): void {
  const envPath = path.join(serverRootDir, '.env');
  loadDotEnv(envPath);
}

// ---------------------------------------------------------------------------
// Generic env access helpers
// ---------------------------------------------------------------------------

export function getEnv(key: string): string | undefined {
  const value = process.env[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export function getEnvOrDefault(key: string, defaultValue: string): string {
  return getEnv(key) ?? defaultValue;
}
