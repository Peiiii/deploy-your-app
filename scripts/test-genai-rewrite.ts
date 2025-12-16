/**
 * Helper script to run the GenAI base URL rewrite fix against a local project.
 *
 * Usage (local path):
 *   pnpm --filter deploy-your-app-server exec tsx scripts/test-genai-rewrite.ts /path/to/project
 *
 * Usage (GitHub URL):
 *   pnpm --filter deploy-your-app-server exec tsx scripts/test-genai-rewrite.ts https://github.com/owner/repo.git
 *
 * Options:
 *   --keep       : keep the cloned temp repo (only when Git URL is provided)
 *   --show-diff  : include full git diff in output (may be verbose)
 *
 * What it does:
 * - Runs rewriteGenAIBaseUrlFix.detect + apply on the given project directory.
 * - If the project is a git repo, prints git status and diff stat after applying.
 * - Otherwise, just reports success and the target base URL used.
 */
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { rewriteGenAIBaseUrlFix } from '../server/src/modules/deployment/fixes/rewriteGenAIBaseUrl.js';

const enableColor = process.stdout.isTTY;
const colorize = (text: string, code: number) =>
  enableColor ? `\u001b[${code}m${text}\u001b[0m` : text;
const dim = (text: string) => colorize(text, 2);
const green = (text: string) => colorize(text, 32);
const yellow = (text: string) => colorize(text, 33);
const cyan = (text: string) => colorize(text, 36);

async function isGitRepo(dir: string): Promise<boolean> {
  try {
    await fs.access(path.join(dir, '.git'));
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a && a !== '--');
  const target = args.find((a) => !a.startsWith('--'));
  const keepClone = args.includes('--keep');
  const showDiff = args.includes('--show-diff');
  if (!target) {
    console.error('Usage: pnpm --filter deploy-your-app-server exec tsx scripts/test-genai-rewrite.ts <path-or-github-url> [--keep] [--show-diff]');
    process.exit(1);
  }

  let workDir = path.resolve(target);
  let clonedFromUrl: string | null = null;
  let cleanupDir: string | null = null;

  // Support cloning from a GitHub URL directly for quick validation.
  if (/^https?:\/\//i.test(target)) {
    clonedFromUrl = target;
    const url = new URL(target);
    const repoName = path.basename(url.pathname.replace(/\.git$/, '')) || 'repo';
    const tmpBase = await fs.mkdtemp(path.join(os.tmpdir(), 'genai-rewrite-'));
    const cloneDir = path.join(tmpBase, repoName);
    console.log(`Cloning ${target} to ${cloneDir} ...`);
    execSync(`git clone ${target} ${cloneDir}`, { stdio: 'inherit' });
    workDir = cloneDir;
    cleanupDir = keepClone ? null : tmpBase;
  }
  const stat = await fs.stat(workDir).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    console.error(`Path is not a directory: ${workDir}`);
    process.exit(1);
  }

  const ctx = { deploymentId: 'local-genai-rewrite', workDir } as const;

  const detected = await rewriteGenAIBaseUrlFix.detect(ctx);
  if (!detected) {
    console.log(`No Google GenAI usage detected under ${workDir}; no changes applied.`);
    return;
  }

  await rewriteGenAIBaseUrlFix.apply(ctx);

  const gitRepo = await isGitRepo(workDir);
  if (gitRepo) {
    const status = execSync('git status --porcelain', {
      cwd: workDir,
      encoding: 'utf8',
    }).trim();
    const diffStat = status
      ? execSync('git diff --stat', { cwd: workDir, encoding: 'utf8' }).trim()
      : '';
    const fullDiff =
      showDiff && status
        ? execSync('git diff --color=always', { cwd: workDir, encoding: 'utf8' })
        : undefined;

    console.log(`${cyan('workDir')}: ${workDir}`);
    console.log(`${cyan('source')}: ${clonedFromUrl ?? 'local-path'}`);
    console.log(`${cyan('changed')}: ${Boolean(status) ? green('true') : dim('false')}`);
    if (status) {
      console.log(`${cyan('status')}:\n${status}`);
      console.log(`${cyan('diffStat')}:\n${diffStat}`);
    }
    if (fullDiff) {
      console.log(dim('--- git diff ---'));
      console.log(fullDiff);
      console.log(dim('--- end diff ---'));
    }
  } else {
    console.log(`${cyan('workDir')}: ${workDir}`);
    console.log(`${cyan('source')}: ${clonedFromUrl ?? 'local-path'}`);
    console.log(
      yellow(
        'Rewrite applied (not a git repository, so no diff summary available).',
      ),
    );
  }

  if (cleanupDir) {
    await fs.rm(cleanupDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
