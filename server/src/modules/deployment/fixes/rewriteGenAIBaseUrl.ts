import { applyRuleBasedRewrite, looksLikeGenAIClient } from '@gemigo/deployment-assets';
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
    return raw.replace(/\/+$/, '');
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
