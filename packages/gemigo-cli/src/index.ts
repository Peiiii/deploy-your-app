import { deployStaticApp } from './deploy.js';
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

function renderHelp(): string {
  return `GemiGo CLI

Usage:
  gemigo login [--provider github|google] [--origin https://gemigo.io] [--no-browser]
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
