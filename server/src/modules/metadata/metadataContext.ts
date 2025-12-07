import * as fs from 'fs';
import * as path from 'path';

const MAX_CONTEXT_LENGTH = 2000;
const MAX_FILE_LIST = 20;

function trimContext(value: string): string {
  if (value.length <= MAX_CONTEXT_LENGTH) return value;
  return value.slice(0, MAX_CONTEXT_LENGTH);
}

async function collectDirContext(rootDir: string): Promise<string | null> {
  try {
    const exists = fs.existsSync(rootDir);
    if (!exists) return null;
    const snippets: string[] = [];

    const indexPath = path.join(rootDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      const html = await fs.promises.readFile(indexPath, 'utf8').catch(() => '');
      if (html) {
        const normalized = trimContext(html.replace(/\s+/g, ' ').trim());
        if (normalized) {
          snippets.push(`index.html snippet:\n${normalized}`);
        }
      }
    }

    try {
      const entries = await fs.promises.readdir(rootDir, { withFileTypes: true });
      const names: string[] = [];
      for (const entry of entries) {
        const name = entry.isDirectory() ? `${entry.name}/` : entry.name;
        names.push(name);
        if (names.length >= MAX_FILE_LIST) break;
      }
      if (names.length > 0) {
        snippets.push(`Top-level files:\n${names.join(', ')}`);
      }
    } catch {
      // ignore
    }

    if (snippets.length === 0) return null;
    const combined = snippets.join('\n\n');
    return trimContext(combined);
  } catch {
    return null;
  }
}

export function buildInlineHtmlContext(htmlContent?: string): string | null {
  if (!htmlContent) return null;
  const normalized = htmlContent.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  return trimContext(normalized);
}

export async function buildStoredAppContext(
  slug: string,
  staticRoot: string,
): Promise<string | null> {
  const dir = path.join(staticRoot, slug);
  return collectDirContext(dir);
}

export async function buildWorkDirContext(workDir: string): Promise<string | null> {
  return collectDirContext(workDir);
}
