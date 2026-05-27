import { deployStaticApp, validateStaticAppInput } from './deploy.js';
import { writeManifestTemplate } from './config.js';
import { loginWithBrowser, type LoginProvider } from './login.js';
import { clearSession, loadSession } from './session-store.js';

interface ParsedArgs {
  positionals: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }

    const trimmed = arg.slice(2);
    if (trimmed.startsWith('no-')) {
      flags[trimmed.slice(3)] = false;
      continue;
    }

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex !== -1) {
      const key = trimmed.slice(0, equalsIndex);
      const value = trimmed.slice(equalsIndex + 1);
      flags[key] = value;
      continue;
    }

    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      flags[trimmed] = next;
      index += 1;
    } else {
      flags[trimmed] = true;
    }
  }

  return {
    positionals,
    flags,
  };
}

function getOrigin(flags: Record<string, string | boolean>): string {
  const raw =
    typeof flags.origin === 'string'
      ? flags.origin
      : process.env.GEMIGO_ORIGIN ?? 'https://gemigo.io';
  return raw.replace(/\/+$/, '');
}

function getStringFlag(
  flags: Record<string, string | boolean>,
  name: string,
): string | undefined {
  return typeof flags[name] === 'string' ? flags[name] : undefined;
}

function getVisibilityFlag(
  flags: Record<string, string | boolean>,
): 'public' | 'private' | undefined {
  const visibility = getStringFlag(flags, 'visibility');
  if (!visibility) return undefined;
  if (visibility === 'public' || visibility === 'private') return visibility;
  throw new Error('init --visibility must be "public" or "private".');
}

function getTagsFlag(flags: Record<string, string | boolean>): string[] | undefined {
  const raw = getStringFlag(flags, 'tags');
  if (!raw) return undefined;
  const tags = raw
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
  return tags.length > 0 ? tags : undefined;
}

function renderHelp(): string {
  return `GemiGo CLI

Usage:
  gemigo init [dir] [--config ./gemigo.app.json] [--name "My App"] [--description "..."] [--force]
  gemigo validate [dir] [--config ./gemigo.app.json]
  gemigo login [--origin https://gemigo.io] [--no-browser]
  gemigo whoami [--origin https://gemigo.io]
  gemigo logout
  gemigo deploy <dir> [--config ./gemigo.app.json] [--origin https://gemigo.io]
  gemigo publish <dir> [--config ./gemigo.app.json] [--origin https://gemigo.io]
`;
}

export async function runCli(argv: string[]): Promise<void> {
  const [command, ...rest] = argv;

  if (!command || command === 'help' || command === '--help') {
    process.stdout.write(`${renderHelp()}\n`);
    return;
  }

  const parsed = parseArgs(rest);
  const origin = getOrigin(parsed.flags);

  if (command === 'init') {
    const dir = parsed.positionals.length > 0 ? parsed.positionals[0] : '.';
    const result = await writeManifestTemplate({
      cwd: process.cwd(),
      dir,
      configPath: getStringFlag(parsed.flags, 'config'),
      force: parsed.flags.force === true,
      name: getStringFlag(parsed.flags, 'name'),
      description: getStringFlag(parsed.flags, 'description'),
      slug: getStringFlag(parsed.flags, 'slug'),
      visibility: getVisibilityFlag(parsed.flags),
      category: getStringFlag(parsed.flags, 'category'),
      tags: getTagsFlag(parsed.flags),
      defaultLocale: getStringFlag(parsed.flags, 'locale'),
    });
    process.stdout.write(`Created manifest: ${result.manifestPath}\n`);
    process.stdout.write(
      `Validate it with: gemigo validate --config ${result.manifestPath}\n`,
    );
    return;
  }

  if (command === 'validate') {
    const dir =
      parsed.positionals.length > 0 ? parsed.positionals[0] : undefined;
    const result = await validateStaticAppInput({
      cwd: process.cwd(),
      dir,
      configPath: getStringFlag(parsed.flags, 'config'),
    });
    process.stdout.write(`Manifest OK: ${result.manifestPath}\n`);
    process.stdout.write(
      `Static directory OK: ${result.dir} (${result.fileCount} files)\n`,
    );
    return;
  }

  if (command === 'login') {
    const provider =
      typeof parsed.flags.provider === 'string'
        ? (parsed.flags.provider as LoginProvider)
        : 'github';

    if (provider !== 'github' && provider !== 'google') {
      throw new Error('login --provider must be "github" or "google".');
    }

    const session = await loginWithBrowser({
      origin,
      provider,
      openBrowser: parsed.flags.browser !== false,
    });
    process.stdout.write(
      `Logged in as ${session.user.displayName ?? session.user.email ?? session.user.id}\n`,
    );
    return;
  }

  if (command === 'whoami') {
    const session = await loadSession();
    if (!session) {
      throw new Error('No saved session found. Run "gemigo login" first.');
    }
    process.stdout.write(
      `${session.user.displayName ?? session.user.email ?? session.user.id}\n`,
    );
    return;
  }

  if (command === 'logout') {
    await clearSession();
    process.stdout.write('Logged out.\n');
    return;
  }

  if (command === 'deploy' || command === 'publish') {
    const dir =
      parsed.positionals.length > 0 ? parsed.positionals[0] : undefined;
    const configPath =
      typeof parsed.flags.config === 'string'
        ? parsed.flags.config
        : undefined;

    const result = await deployStaticApp({
      origin,
      dir,
      configPath,
      onOutput: (line) => {
        process.stdout.write(`${line}\n`);
      },
    });

    process.stdout.write(`Deployment complete.\n`);
    if (result.slug) {
      process.stdout.write(`Slug: ${result.slug}\n`);
    }
    if (result.url) {
      process.stdout.write(`URL: ${result.url}\n`);
    }
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}
