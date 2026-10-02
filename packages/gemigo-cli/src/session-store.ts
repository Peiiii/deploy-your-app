import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { StoredSession } from './types.js';

export async function loadSession(): Promise<StoredSession | null> {
  try {
    const raw = await fs.readFile(getSessionPath(), 'utf8');
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export async function saveSession(session: StoredSession): Promise<void> {
  const sessionPath = getSessionPath();
  await fs.mkdir(path.dirname(sessionPath), { recursive: true, mode: 0o700 });
  await fs.writeFile(sessionPath, JSON.stringify(session, null, 2), { encoding: 'utf8', mode: 0o600 });
  await fs.chmod(sessionPath, 0o600);
}

export async function clearSession(): Promise<void> {
  await fs.rm(getSessionPath(), { force: true });
}

export function getSessionPath(): string {
  return path.join(os.homedir(), '.gemigo', 'cli-session.json');
}
