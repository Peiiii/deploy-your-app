import * as fs from 'fs';
import * as path from 'path';
import { builtinModules } from 'module';
import { appendLog } from '../pipeline/deploymentEvents.js';
import type { RepoFix, RepoFixContext } from './types.js';

const AI_STUDIO_ENTRY_CANDIDATES = [
  'index.tsx',
  'index.jsx',
  'index.ts',
  'index.js',
];

const SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
]);

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  '.next',
  '.output',
  '.vercel',
  '.git',
  '.cache',
]);

const SERVER_RUNTIME_DIRS = ['server', 'backend', 'functions'];
const SERVER_RUNTIME_ENTRY_FILES = [
  'server.ts',
  'server.tsx',
  'server.js',
  'server.jsx',
  'server.mjs',
  'server.cjs',
  'backend.ts',
  'backend.js',
];

const SERVER_RUNTIME_PACKAGES = new Set([
  '@google-cloud/functions-framework',
  '@hono/node-server',
  'cors',
  'express',
  'fastify',
  'firebase-admin',
  'googleapis',
  'hono',
  'socket.io',
  'ws',
]);

const NODE_BUILTINS = new Set([
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`),
]);

const DEFAULT_DEPENDENCIES = new Map<string, string>([
  ['@google/genai', '^1.30.0'],
  ['react', '^19.2.0'],
  ['react-dom', '^19.2.0'],
]);

const KNOWN_DEPENDENCY_VERSIONS = new Map<string, string>([
  ['@google/genai', '^1.30.0'],
  ['framer-motion', '^12.23.26'],
  ['lucide-react', '^0.555.0'],
  ['react', '^19.2.0'],
  ['react-dom', '^19.2.0'],
  ['react-router-dom', '^7.11.0'],
  ['sonner', '^2.0.7'],
]);

const DEFAULT_DEV_DEPENDENCIES = {
  '@types/react': '^19.2.5',
  '@types/react-dom': '^19.2.3',
  '@vitejs/plugin-react': '^5.1.1',
  typescript: '^5.9.3',
  vite: '^7.2.5',
};

interface ImportMapLike {
  imports?: Record<string, string>;
  scopes?: Record<string, Record<string, string>>;
}

interface SourceScanResult {
  packageNames: Set<string>;
  unsupportedSignals: string[];
}

interface AIStudioProjectInspection {
  dependencies: Record<string, string>;
  entryFile: string;
  packageName: string;
  requestedPermissions: string[];
  unsupportedSignals: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function readJsonRecord(filePath: string): Promise<Record<string, unknown>> {
  const raw = await fs.promises.readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  return isRecord(parsed) ? parsed : {};
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 56);
}

function buildPackageName(metadata: Record<string, unknown>): string {
  const rawName = typeof metadata.name === 'string' ? metadata.name : '';
  const slug = slugify(rawName) || 'app';
  return `ai-studio-${slug}`;
}

function collectRequestedPermissions(
  metadata: Record<string, unknown>,
): string[] {
  const raw = metadata.requestFramePermissions;
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);
}

function metadataUnsupportedSignals(
  metadata: Record<string, unknown>,
): string[] {
  const signals: string[] = [];
  const unsupportedKeys = ['secrets', 'server', 'runtime'];

  for (const key of unsupportedKeys) {
    if (metadata[key] !== undefined) {
      signals.push(`metadata.json declares "${key}"`);
    }
  }

  return signals;
}

function packageNameFromSpecifier(specifier: string): string | null {
  if (
    specifier.startsWith('.') ||
    specifier.startsWith('/') ||
    specifier.startsWith('#') ||
    /^[a-z][a-z0-9+.-]*:/i.test(specifier)
  ) {
    return null;
  }

  const normalized = specifier.replace(/\/+$/, '');
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith('@')) {
    const parts = normalized.split('/');
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
  }

  return normalized.split('/')[0] || null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractPackageVersion(target: string, packageName: string): string | null {
  const decoded = decodeURIComponent(target);
  const pattern = new RegExp(`${escapeRegExp(packageName)}@([^/?#]+)`);
  const match = decoded.match(pattern);

  if (!match || !match[1]) {
    return null;
  }

  return match[1].trim() || null;
}

function mergeDependency(
  dependencies: Map<string, string>,
  packageName: string,
  preferredVersion: string | null,
): void {
  if (NODE_BUILTINS.has(packageName)) {
    return;
  }

  const version =
    preferredVersion ??
    KNOWN_DEPENDENCY_VERSIONS.get(packageName) ??
    'latest';

  dependencies.set(packageName, version);
}

function collectImportMapDependencies(html: string): Map<string, string> {
  const dependencies = new Map<string, string>();
  const pattern =
    /<script[^>]*type=["']importmap["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const json = match[1].trim();
    if (!json) {
      continue;
    }

    let parsed: ImportMapLike;
    try {
      parsed = JSON.parse(json) as ImportMapLike;
    } catch {
      continue;
    }

    const importRecords: Array<Record<string, string> | undefined> = [
      parsed.imports,
      ...Object.values(parsed.scopes ?? {}),
    ];

    for (const imports of importRecords) {
      if (!imports) {
        continue;
      }

      for (const [specifier, target] of Object.entries(imports)) {
        const packageName = packageNameFromSpecifier(specifier);
        if (!packageName) {
          continue;
        }

        mergeDependency(
          dependencies,
          packageName,
          extractPackageVersion(target, packageName),
        );
      }
    }
  }

  return dependencies;
}

function collectImportSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      specifiers.push(match[1]);
    }
  }

  return specifiers;
}

async function collectSourceFiles(root: string): Promise<string[]> {
  const results: string[] = [];
  const stack: string[] = [''];

  while (stack.length > 0) {
    const relDir = stack.pop() as string;
    const current = path.join(root, relDir);
    const entries = await fs.promises.readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) {
        continue;
      }

      const relPath = relDir ? path.join(relDir, entry.name) : entry.name;
      const fullPath = path.join(root, relPath);

      if (entry.isDirectory()) {
        stack.push(relPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (SOURCE_EXTENSIONS.has(ext)) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

function relPath(root: string, filePath: string): string {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

async function scanSourceFiles(root: string): Promise<SourceScanResult> {
  const files = await collectSourceFiles(root);
  const packageNames = new Set<string>();
  const unsupportedSignals: string[] = [];

  for (const filePath of files) {
    const source = await fs.promises.readFile(filePath, 'utf8');
    const relative = relPath(root, filePath);

    for (const specifier of collectImportSpecifiers(source)) {
      if (NODE_BUILTINS.has(specifier)) {
        unsupportedSignals.push(
          `${relative} imports Node.js module "${specifier}"`,
        );
        continue;
      }

      const packageName = packageNameFromSpecifier(specifier);
      if (!packageName) {
        continue;
      }

      if (SERVER_RUNTIME_PACKAGES.has(packageName)) {
        unsupportedSignals.push(
          `${relative} imports server package "${packageName}"`,
        );
      }

      packageNames.add(packageName);
    }

    if (
      /\b(app|server)\.listen\s*\(/.test(source) ||
      /\bcreateServer\s*\(/.test(source) ||
      /\bWebSocketServer\b/.test(source)
    ) {
      unsupportedSignals.push(
        `${relative} contains server runtime entry code`,
      );
    }
  }

  return { packageNames, unsupportedSignals };
}

async function hasSourceFilesUnder(dirPath: string): Promise<boolean> {
  if (!fs.existsSync(dirPath)) {
    return false;
  }

  const stack = [dirPath];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    const entries = await fs.promises.readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) {
        continue;
      }

      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (
        entry.isFile() &&
        SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
      ) {
        return true;
      }
    }
  }

  return false;
}

async function findServerRuntimeSignals(workDir: string): Promise<string[]> {
  const signals: string[] = [];

  for (const dir of SERVER_RUNTIME_DIRS) {
    if (await hasSourceFilesUnder(path.join(workDir, dir))) {
      signals.push(`server-side runtime directory "${dir}/"`);
    }
  }

  for (const file of SERVER_RUNTIME_ENTRY_FILES) {
    if (fs.existsSync(path.join(workDir, file))) {
      signals.push(`server-side runtime file "${file}"`);
    }
  }

  return signals;
}

function buildDependencies(
  importMapDependencies: Map<string, string>,
  sourcePackageNames: Set<string>,
): Record<string, string> {
  const dependencies = new Map(DEFAULT_DEPENDENCIES);

  for (const [packageName, version] of importMapDependencies) {
    mergeDependency(dependencies, packageName, version);
  }

  for (const packageName of sourcePackageNames) {
    mergeDependency(dependencies, packageName, null);
  }

  return Object.fromEntries(
    [...dependencies.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
}

async function inspectAIStudioProject(
  workDir: string,
): Promise<AIStudioProjectInspection | null> {
  if (fs.existsSync(path.join(workDir, 'package.json'))) {
    return null;
  }

  const metadataPath = path.join(workDir, 'metadata.json');
  const htmlPath = path.join(workDir, 'index.html');

  if (!fs.existsSync(metadataPath) || !fs.existsSync(htmlPath)) {
    return null;
  }

  const entryFile = AI_STUDIO_ENTRY_CANDIDATES.find((candidate) =>
    fs.existsSync(path.join(workDir, candidate)),
  );

  if (!entryFile) {
    return null;
  }

  const metadata = await readJsonRecord(metadataPath);
  const html = await fs.promises.readFile(htmlPath, 'utf8');
  const importMapDependencies = collectImportMapDependencies(html);
  const sourceScan = await scanSourceFiles(workDir);
  const serverSignals = await findServerRuntimeSignals(workDir);
  const unsupportedSignals = [
    ...metadataUnsupportedSignals(metadata),
    ...serverSignals,
    ...sourceScan.unsupportedSignals,
  ];

  return {
    dependencies: buildDependencies(
      importMapDependencies,
      sourceScan.packageNames,
    ),
    entryFile,
    packageName: buildPackageName(metadata),
    requestedPermissions: collectRequestedPermissions(metadata),
    unsupportedSignals,
  };
}

async function writeIfMissing(
  filePath: string,
  content: string,
): Promise<boolean> {
  if (fs.existsSync(filePath)) {
    return false;
  }

  await fs.promises.writeFile(filePath, content, 'utf8');
  return true;
}

function buildPackageJson(inspection: AIStudioProjectInspection): string {
  return `${JSON.stringify(
    {
      name: inspection.packageName,
      version: '0.0.0',
      private: true,
      type: 'module',
      scripts: {
        dev: 'vite --host 0.0.0.0',
        build: 'vite build',
      },
      dependencies: inspection.dependencies,
      devDependencies: DEFAULT_DEV_DEPENDENCIES,
    },
    null,
    2,
  )}\n`;
}

function buildViteConfig(): string {
  return `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    'process.env.API_KEY': JSON.stringify('xxx'),
    'process.env.GEMINI_API_KEY': JSON.stringify('xxx'),
  },
});
`;
}

function buildTsConfig(): string {
  return `${JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        useDefineForClassFields: true,
        lib: ['DOM', 'DOM.Iterable', 'ES2022'],
        allowJs: true,
        skipLibCheck: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: false,
        forceConsistentCasingInFileNames: true,
        module: 'ESNext',
        moduleResolution: 'Bundler',
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: 'react-jsx',
      },
      include: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
      exclude: ['node_modules', 'dist', 'build', 'out'],
    },
    null,
    2,
  )}\n`;
}

export const aiStudioAppProjectFix: RepoFix = {
  id: 'ai-studio-app-project',
  description:
    'Generate a minimal Vite/React project wrapper for AI Studio App exports that contain metadata.json and index.tsx but no package.json.',
  fatalOnError: true,

  async detect(ctx: RepoFixContext): Promise<boolean> {
    if (ctx.distDir) {
      return false;
    }

    return (await inspectAIStudioProject(ctx.workDir)) !== null;
  },

  async apply(ctx: RepoFixContext): Promise<void> {
    const inspection = await inspectAIStudioProject(ctx.workDir);
    if (!inspection) {
      return;
    }

    if (inspection.unsupportedSignals.length > 0) {
      const details = inspection.unsupportedSignals
        .slice(0, 5)
        .map((signal) => `- ${signal}`)
        .join('\n');
      throw new Error(
        'This AI Studio app appears to require the AI Studio server-side runtime, which is not supported by the current static deployment pipeline. ' +
          'Please export a client-only AI Studio app or add backend runtime support before deploying.\n' +
          details,
      );
    }

    const packageWritten = await writeIfMissing(
      path.join(ctx.workDir, 'package.json'),
      buildPackageJson(inspection),
    );
    const viteConfigWritten = await writeIfMissing(
      path.join(ctx.workDir, 'vite.config.ts'),
      buildViteConfig(),
    );
    const tsConfigWritten = await writeIfMissing(
      path.join(ctx.workDir, 'tsconfig.json'),
      buildTsConfig(),
    );

    appendLog(
      ctx.deploymentId,
      `Detected AI Studio App export (${inspection.entryFile}); generated build wrapper: ${[
        packageWritten ? 'package.json' : null,
        viteConfigWritten ? 'vite.config.ts' : null,
        tsConfigWritten ? 'tsconfig.json' : null,
      ]
        .filter(Boolean)
        .join(', ') || 'already present'}.`,
      'info',
    );

    const dependencyNames = Object.keys(inspection.dependencies);
    appendLog(
      ctx.deploymentId,
      `AI Studio App dependencies resolved: ${dependencyNames.join(', ')}`,
      'info',
    );

    if (inspection.requestedPermissions.length > 0) {
      appendLog(
        ctx.deploymentId,
        `AI Studio metadata requests frame permissions: ${inspection.requestedPermissions.join(', ')}`,
        'info',
      );
    }
  },
};
