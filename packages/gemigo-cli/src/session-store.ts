import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { StoredSession } from './types.js';

const SESSION_DIR = path.join(os.homedir(), '.gemigo');
const SESSION_PATH = path.join(SESSION_DIR, 'cli-session.json');

export async function loadSession(): Promise<StoredSession | null> {
  try {
    const raw = await fs.readFile(SESSION_PATH, 'utf8');
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export async function saveSession(session: StoredSession): Promise<void> {
  await fs.mkdir(SESSION_DIR, { recursive: true, mode: 0o700 });
  await fs.writeFile(SESSION_PATH, JSON.stringify(session, null, 2), { encoding: 'utf8', mode: 0o600 });
  await fs.chmod(SESSION_PATH, 0o600);
}

export async function clearSession(): Promise<void> {
  await fs.rm(SESSION_PATH, { force: true });
}

export function getSessionPath(): string {
  return SESSION_PATH;
}
