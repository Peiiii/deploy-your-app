import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const run = (command, options = {}) => {
  return execSync(command, {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    ...options,
  }).trim();
};

const runInherit = (command, options = {}) => {
  execSync(command, {
    stdio: 'inherit',
    ...options,
  });
};

const parseArgs = (argv) => {
  const args = {
    remote: 'origin',
    skipCleanCheck: false,
    annotate: true,
    message: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--remote') {
      args.remote = argv[i + 1] ?? 'origin';
      i += 1;
      continue;
    }
    if (token === '--skip-clean-check') {
      args.skipCleanCheck = true;
      continue;
    }
    if (token === '--lightweight') {
      args.annotate = false;
      continue;
    }
    if (token === '--message') {
      args.message = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }
  }

  return args;
};

const printHelp = () => {
  console.log(`Usage:
  pnpm release:desktop

Options:
  --remote <name>         Git remote to push to (default: origin)
  --skip-clean-check      Allow dirty working tree
  --lightweight           Create lightweight tag instead of annotated
  --message <text>        Tag message (annotated tag only)
`);
};

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const repoRoot = run('git rev-parse --show-toplevel');
  const desktopPkgPath = path.join(repoRoot, 'desktop', 'package.json');
  const desktopPkg = JSON.parse(fs.readFileSync(desktopPkgPath, 'utf8'));
  const version = desktopPkg.version;

  if (typeof version !== 'string' || version.trim().length === 0) {
    throw new Error(`Invalid desktop package version in ${desktopPkgPath}`);
  }

  if (!args.skipCleanCheck) {
    const status = run('git status --porcelain', { cwd: repoRoot });
    if (status.length > 0) {
      throw new Error(
        'Working tree is not clean. Commit/stash changes or re-run with --skip-clean-check.',
      );
    }
  }

  const tag = `desktop-v${version}`;

  try {
    run(`git rev-parse -q --verify "refs/tags/${tag}"`, { cwd: repoRoot });
    throw new Error(`Tag already exists: ${tag}`);
  } catch (err) {
    // Expected when tag does not exist.
    if (err instanceof Error && err.message.includes('Tag already exists')) {
      throw err;
    }
  }

  console.log(`[desktop-release] version=${version} tag=${tag} remote=${args.remote}`);

  if (args.annotate) {
    const message = args.message ?? `Gemigo Desktop ${version}`;
    runInherit(`git tag -a ${tag} -m "${message.replaceAll('"', '\\"')}"`, {
      cwd: repoRoot,
    });
  } else {
    runInherit(`git tag ${tag}`, { cwd: repoRoot });
  }

  runInherit(`git push ${args.remote} ${tag}`, { cwd: repoRoot });

  console.log(
    `[desktop-release] pushed tag ${tag}. GitHub Actions will build & publish the installers.`,
  );
};

main();
