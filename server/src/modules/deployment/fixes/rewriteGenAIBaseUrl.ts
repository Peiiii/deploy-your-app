import * as fs from 'fs';
import * as path from 'path';
import { GENAI_PROXY_BASE_URL } from '../../../common/config/config.js';
import { appendLog } from '../pipeline/deploymentEvents.js';
import type { RepoFix, RepoFixContext } from './types.js';
import { getAIService } from '../../ai/ai.service.js';

/**
 * Rewrites Google GenAI / AI Studio clients to route through the platform proxy.
 * Coverage (rule-based):
 * - Imports using @google/genai / @google/generative-ai
 * - Constructors: new GoogleGenerativeAI(...) / new GoogleGenAI(...)
 * - Base URL keys: baseUrl / apiEndpoint
 * - httpOptions: { baseUrl }
 * - Direct domain hits: generativelanguage.googleapis.com, aistudio.googleapis.com, ai.google.dev
 *
 * If rule-based rewrite makes no change and platform AI key is present,
 * falls back to an AI rewrite for best effort.
 */

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.next',
  '.output',
  '.vercel',
  '.git',
  '.cache',
]);

const SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
]);

const GOOGLE_GENAI_PACKAGES = ['@google/generative-ai', '@google/genai'];

const GOOGLE_ENDPOINT_PREFIXES = [
  'https://generativelanguage.googleapis.com',
  'https://aistudio.googleapis.com',
  'https://aistudio.google.com',
  'https://ai.google.dev',
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeBaseUrl(raw: string): string {
  return raw.replace(/\/+$/, '');
}

function looksLikeGenAIClient(content: string): boolean {
  return (
    /@google\/gen(erative-ai|ai)\b/.test(content) ||
    /\bGoogleGenerativeAI\b/.test(content) ||
    /\bGoogleAI(Client)?\b/.test(content) ||
    /generativelanguage\.googleapis\.com/.test(content)
  );
}

async function collectGenAIFiles(root: string): Promise<string[]> {
  const results: string[] = [];
  const stack: string[] = [root];

  while (stack.length > 0) {
    const current = stack.pop() as string;
    const entries = await fs.promises.readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;

      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (!SOURCE_EXTENSIONS.has(ext)) continue;

      try {
        const content = await fs.promises.readFile(full, 'utf8');
        if (looksLikeGenAIClient(content)) {
          results.push(full);
        }
      } catch {
        // Ignore unreadable files and continue scanning.
      }
    }
  }

  return results;
}

function ensureBaseAndEndpointInObject(
  objectSource: string,
  targetBaseUrl: string,
): string {
  const basePattern = /baseUrl\s*:\s*(['"`])[^'"`]*\1/;
  const endpointPattern = /apiEndpoint\s*:\s*(['"`])[^'"`]*\1/;
  let updated = objectSource;

  const hasBase = basePattern.test(updated);
  const hasEndpoint = endpointPattern.test(updated);

  if (hasBase) {
    updated = updated.replace(basePattern, `baseUrl: '${targetBaseUrl}'`);
  }
  if (hasEndpoint) {
    updated = updated.replace(
      endpointPattern,
      `apiEndpoint: '${targetBaseUrl}'`,
    );
  }

  if (hasBase && hasEndpoint) {
    return updated;
  }

  const trimmed = updated.trimEnd();
  const closeIdx = trimmed.lastIndexOf('}');
  if (closeIdx === -1) return updated;

  const before = updated.slice(0, closeIdx);
  const after = updated.slice(closeIdx);
  const needsComma = /{\s*$/.test(before.trim()) ? '' : ',';
  const indentMatch = before.match(/(\n\s*)[^\n]*$/);
  const indent = indentMatch ? indentMatch[1] : ' ';

  const additions: string[] = [];
  if (!hasBase) additions.push(`baseUrl: '${targetBaseUrl}'`);
  if (!hasEndpoint) additions.push(`apiEndpoint: '${targetBaseUrl}'`);

  return `${before}${needsComma}${indent}${additions.join(
    `,${indent}`,
  )}${after}`;
}

function upsertHttpOptions(objectSource: string, targetBaseUrl: string): string {
  const httpOptionsPattern = /httpOptions\s*:\s*{([\s\S]*?)}/m;

  if (httpOptionsPattern.test(objectSource)) {
    return objectSource.replace(httpOptionsPattern, (_match, inner) => {
      const withBase = ensureBaseAndEndpointInObject(
        `{${inner}}`,
        targetBaseUrl,
      );
      return `httpOptions: ${withBase}`;
    });
  }

  const trimmed = objectSource.trimEnd();
  const closeIdx = trimmed.lastIndexOf('}');
  if (closeIdx === -1) return objectSource;

  const before = objectSource.slice(0, closeIdx);
  const after = objectSource.slice(closeIdx);
  const needsComma = /{\s*$/.test(before.trim()) ? '' : ',';
  const indentMatch = before.match(/(\n\s*)[^\n]*$/);
  const indent = indentMatch ? indentMatch[1] : ' ';

  return `${before}${needsComma}${indent}httpOptions: { baseUrl: '${targetBaseUrl}', apiEndpoint: '${targetBaseUrl}' }${after}`;
}

function rewriteGoogleGenAIStyleInstances(
  source: string,
  targetBaseUrl: string,
): string {
  let updated = source;
  const classNames = ['GoogleGenerativeAI', 'GoogleGenAI'];

  for (const className of classNames) {
    const withOptions = new RegExp(
      `new\\s+${className}\\s*\\(\\s*({[\\s\\S]*?})\\s*\\)`,
      'g',
    );
    updated = updated.replace(withOptions, (full, options) => {
      const withHttpOptions = upsertHttpOptions(options, targetBaseUrl);
      return full.replace(options, withHttpOptions);
    });

    const withApiKeyOnly = new RegExp(
      `new\\s+${className}\\s*\\(\\s*([^)]+?)\\s*\\)`,
      'g',
    );
    updated = updated.replace(withApiKeyOnly, (full, arg) => {
      if (/{/.test(arg)) {
        return full;
      }
      const trimmedArg = arg.trim();
      if (trimmedArg.length === 0) {
        return full;
      }
      return `new ${className}({ apiKey: ${trimmedArg}, httpOptions: { baseUrl: '${targetBaseUrl}', apiEndpoint: '${targetBaseUrl}' } })`;
    });
  }

  return updated;
}

function rewriteGoogleAIClientInstances(
  source: string,
  targetBaseUrl: string,
): string {
  let updated = source;

  updated = updated.replace(
    /new\s+(GoogleAIClient|GoogleAI)\s*\(\s*({[\s\S]*?})\s*\)/g,
    (full, _className, options) => {
      const withTopLevelBase = ensureBaseAndEndpointInObject(
        options,
        targetBaseUrl,
      );
      const withHttpOptions = upsertHttpOptions(
        withTopLevelBase,
        targetBaseUrl,
      );
      return full.replace(options, withHttpOptions);
    },
  );

  updated = updated.replace(
    /new\s+(GoogleAIClient|GoogleAI)\s*\(\s*([^)]+?)\s*\)/g,
    (full, className, arg) => {
      if (/{/.test(arg)) {
        return full;
      }
      const trimmedArg = arg.trim();
      if (trimmedArg.length === 0) {
        return full;
      }
      return `new ${className}({ apiKey: ${trimmedArg}, httpOptions: { baseUrl: '${targetBaseUrl}', apiEndpoint: '${targetBaseUrl}' } })`;
    },
  );

  return updated;
}

function applyRuleBasedRewrite(
  content: string,
  targetBaseUrl: string,
): string {
  let updated = content;

  for (const endpoint of GOOGLE_ENDPOINT_PREFIXES) {
    updated = updated.replace(
      new RegExp(escapeRegExp(endpoint), 'g'),
      targetBaseUrl,
    );
  }

  updated = updated.replace(
    /(baseUrl|apiEndpoint)\s*:\s*(['"`])[^'"`]*\2/g,
    `$1: '${targetBaseUrl}'`,
  );

  updated = rewriteGoogleGenAIStyleInstances(updated, targetBaseUrl);
  updated = rewriteGoogleAIClientInstances(updated, targetBaseUrl);

  return updated;
}

async function hasGenAIDependencies(pkgPath: string): Promise<boolean> {
  if (!fs.existsSync(pkgPath)) return false;

  try {
    const raw = await fs.promises.readFile(pkgPath, 'utf8');
    const pkg = JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = Object.keys(pkg.dependencies ?? {});
    const devDeps = Object.keys(pkg.devDependencies ?? {});
    const all = new Set([...deps, ...devDeps]);
    return GOOGLE_GENAI_PACKAGES.some((name) => all.has(name));
  } catch {
    return false;
  }
}

function selectTargetBaseUrl(): string {
    const raw =
      process.env.GENAI_PROXY_BASE_URL ??
      process.env.GENAI_API_BASE_URL ??
      GENAI_PROXY_BASE_URL;
    return normalizeBaseUrl(raw);
}

export const rewriteGenAIBaseUrlFix: RepoFix = {
  id: 'rewrite-genai-base-url',
  description:
    'Retarget Google GenAI (AI Studio) apps to the platform proxy base URL, with rule-based rewrites and AI fallback.',

  async detect(ctx: RepoFixContext): Promise<boolean> {
    const pkgPath = path.join(ctx.workDir, 'package.json');
    const hasPkgMatch = await hasGenAIDependencies(pkgPath);
    const files = await collectGenAIFiles(ctx.workDir);

    if (hasPkgMatch || files.length > 0) {
      appendLog(
        ctx.deploymentId,
        hasPkgMatch
          ? 'Detected @google/genai dependency; preparing to rewrite base URL.'
          : 'Detected Google GenAI usage in source; preparing to rewrite base URL.',
        'info',
      );
      return true;
    }

    return false;
  },

  async apply(ctx: RepoFixContext): Promise<void> {
    const targetBaseUrl = selectTargetBaseUrl();
    const files = await collectGenAIFiles(ctx.workDir);

    if (files.length === 0) {
      return;
    }

    const aiService = getAIService();
    const canUseAI = aiService.hasCredentials();
    let updatedCount = 0;
    let aiAttempts = 0;

    for (const filePath of files) {
      const original = await fs.promises.readFile(filePath, 'utf8');
      const rewritten = applyRuleBasedRewrite(original, targetBaseUrl);

      if (rewritten === original && canUseAI) {
        aiAttempts += 1;
        const aiResult = await aiService.rewriteGenAIBaseUrl(
          filePath,
          original,
          targetBaseUrl,
        );
        if (aiResult && aiResult.length > 0 && aiResult !== original) {
          await fs.promises.writeFile(filePath, aiResult, 'utf8');
          updatedCount += 1;
        }
        continue;
      }

      if (rewritten !== original) {
        await fs.promises.writeFile(filePath, rewritten, 'utf8');
        updatedCount += 1;
      }
    }

    if (updatedCount === 0 && !canUseAI) {
      appendLog(
        ctx.deploymentId,
        'Detected Google GenAI usage but no platform AI key available for automated rewrite. Skipping GenAI base URL retargeting.',
        'warning',
      );
    } else if (updatedCount === 0 && aiAttempts > 0) {
      appendLog(
        ctx.deploymentId,
        'Google GenAI rewrite attempted but no changes were produced by AI. Please verify the app manually.',
        'warning',
      );
    }
  },
};
