import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Minimal .env loader for the backend.
// This ensures the Node server sees values from the root .env file
// without adding an extra dependency.
const envPath = path.resolve(__dirname, '..', '.env');
try {
  const content = fs.readFileSync(envPath, 'utf8');
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
} catch {
  // No .env present or unreadable – silently ignore.
}

export const PLATFORM_AI_PROVIDER =
  process.env.PLATFORM_AI_PROVIDER || 'dashscope';

export const PLATFORM_AI_MODEL =
  process.env.PLATFORM_AI_MODEL || 'qwen3-max';

// 我们平台自己的 DashScope Key，用于平台 AI 能力（不是用户自己的 key）
export const DASHSCOPE_API_KEY =
  process.env.DASHSCOPE_API_KEY || process.env.DASHSCOPE_APIKEY || '';
