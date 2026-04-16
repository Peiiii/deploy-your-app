import AdmZip from 'adm-zip';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface StaticSiteValidationResult {
  dir: string;
  fileCount: number;
}

async function countFiles(rootDir: string): Promise<number> {
  let total = 0;
  const entries = await fs.readdir(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      total += await countFiles(fullPath);
    } else if (entry.isFile()) {
      total += 1;
    }
  }

  return total;
}

export async function validateStaticDirectory(
  dir: string,
): Promise<StaticSiteValidationResult> {
  const resolvedDir = path.resolve(dir);
  const stat = await fs.stat(resolvedDir).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    throw new Error(`Static directory not found: ${resolvedDir}`);
  }

  const indexPath = path.join(resolvedDir, 'index.html');
  const packageJsonPath = path.join(resolvedDir, 'package.json');

  await fs.access(indexPath).catch(() => {
    throw new Error(
      `Static directory must contain index.html at its root: ${resolvedDir}`,
    );
  });

  const packageJsonExists = await fs
    .access(packageJsonPath)
    .then(() => true)
    .catch(() => false);
  if (packageJsonExists) {
    throw new Error(
      `Static directory must not contain a top-level package.json: ${resolvedDir}`,
    );
  }

  return {
    dir: resolvedDir,
    fileCount: await countFiles(resolvedDir),
  };
}

export async function zipDirectoryToBase64(dir: string): Promise<string> {
  const zip = new AdmZip();
  zip.addLocalFolder(dir);
  return zip.toBuffer().toString('base64');
}
