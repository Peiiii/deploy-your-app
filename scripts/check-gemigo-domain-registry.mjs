import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPEC_PATH = path.join(REPO_ROOT, 'docs/tech/APP_SDK_AUTH_V0_TECH_SPEC.md');

const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.toml',
  '.yaml',
  '.yml',
  '.html',
  '.css',
  '.txt',
  '.env',
]);

function shouldScanFile(filePath) {
  const normalized = filePath.replaceAll('\\', '/');
  if (normalized === 'pnpm-lock.yaml') return false;
  const ext = path.extname(filePath).toLowerCase();
  return TEXT_EXTENSIONS.has(ext) || ext === '';
}

function loadTrackedFiles() {
  const out = execFileSync('git', ['ls-files'], { cwd: REPO_ROOT, encoding: 'utf8' });
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(shouldScanFile);
}

function extractAllowedHostsFromSpec(specText) {
  const allowedHosts = new Set();
  const hostRegex = /`((?:[a-z0-9][a-z0-9.-]*\.)?gemigo\.(?:io|app))`/gi;
  for (const match of specText.matchAll(hostRegex)) {
    allowedHosts.add(match[1].toLowerCase());
  }

  const allowWildcardGemigoApp =
    specText.includes('`*.gemigo.app`') || specText.includes('`{slug}.gemigo.app`');

  return { allowedHosts, allowWildcardGemigoApp };
}

function isAllowedHost({ host, allowedHosts, allowWildcardGemigoApp }) {
  const h = host.toLowerCase();
  if (h === 'gemigo.io' || h.endsWith('.gemigo.io')) return allowedHosts.has(h);

  if (h === 'gemigo.app') return allowedHosts.has(h) || allowWildcardGemigoApp;
  if (h.endsWith('.gemigo.app')) return allowWildcardGemigoApp || allowedHosts.has(h);

  return true;
}

async function main() {
  const specText = await fs.readFile(SPEC_PATH, 'utf8');
  const { allowedHosts, allowWildcardGemigoApp } = extractAllowedHostsFromSpec(specText);

  if (!allowedHosts.has('gemigo.io')) {
    throw new Error(
      `Domain registry spec must include \`gemigo.io\` (missing in ${path.relative(REPO_ROOT, SPEC_PATH)}).`,
    );
  }

  const files = loadTrackedFiles();
  const used = new Map(); // host -> Set<file>

  const usedHostRegex = /((?:[a-z0-9][a-z0-9.-]*\.)?gemigo\.(?:io|app))/gi;
  for (const file of files) {
    const abs = path.join(REPO_ROOT, file);
    let text;
    try {
      text = await fs.readFile(abs, 'utf8');
    } catch {
      continue;
    }

    for (const match of text.matchAll(usedHostRegex)) {
      const host = match[1].toLowerCase();
      if (!used.has(host)) used.set(host, new Set());
      used.get(host).add(file);
    }
  }

  const unknown = [];
  for (const host of used.keys()) {
    if (
      !isAllowedHost({
        host,
        allowedHosts,
        allowWildcardGemigoApp,
      })
    ) {
      unknown.push(host);
    }
  }

  if (unknown.length > 0) {
    unknown.sort();
    const lines = [
      'Unknown GemiGo hostnames found in repo (not registered in the domain registry spec):',
      ...unknown.map((host) => {
        const example = Array.from(used.get(host) ?? []).slice(0, 3).join(', ');
        return `- ${host}  (e.g. ${example})`;
      }),
      '',
      `Register them in: ${path.relative(REPO_ROOT, SPEC_PATH)} (section 4.1).`,
    ];
    console.error(lines.join('\n'));
    process.exit(1);
  }

  console.log(
    `OK: All *.gemigo.io / *.gemigo.app hostnames are registered in ${path.relative(REPO_ROOT, SPEC_PATH)}.`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

