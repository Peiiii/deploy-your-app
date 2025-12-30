import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const repoRoot = resolve(process.cwd());
const distDir = join(repoRoot, 'browser-extension', 'dist');
const manifestPath = join(distDir, 'manifest.json');

assert(existsSync(distDir), `Missing dist dir: ${distDir}. Run "pnpm build:extension" first.`);
assert(existsSync(manifestPath), `Missing dist manifest: ${manifestPath}. Run "pnpm build:extension" first.`);

const manifest = readJson(manifestPath);
const version = manifest.version || '0.0.0';
const name = manifest.name || 'extension';

assert(!String(name).includes('(Dev)'), `Refusing to package Dev build (manifest name is "${name}").`);

const csp = manifest?.content_security_policy?.extension_pages || '';
assert(!csp.includes('127.0.0.1') && !csp.includes('localhost'), 'Refusing to package manifest with localhost in CSP.');

const releaseDir = join(repoRoot, 'browser-extension', 'release');
mkdirSync(releaseDir, { recursive: true });

const safeName = String(name)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 40) || 'extension';

const zipPath = join(releaseDir, `${safeName}-v${version}.zip`);
if (existsSync(zipPath)) rmSync(zipPath);

execFileSync('zip', ['-r', zipPath, '.'], { cwd: distDir, stdio: 'inherit' });
console.log(`\n✓ Packaged: ${zipPath}`);

