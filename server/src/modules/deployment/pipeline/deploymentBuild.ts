import * as path from 'path';
import * as fs from 'fs';
import { spawn, execFile, SpawnOptions } from 'child_process';
import { CONFIG } from '../../../common/config/config.js';
import { appendLog } from './deploymentEvents.js';

/**
 * Strip ANSI escape codes from a string.
 * Build tools like Vite/Webpack output colored terminal logs,
 * but we want clean text in our SSE stream.
 */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

export async function copyDir(src: string, dest: string): Promise<void> {
  await fs.promises.mkdir(dest, { recursive: true });
  const entries = await fs.promises.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(from, to);
    } else if (entry.isFile()) {
      await fs.promises.copyFile(from, to);
    }
  }
}

/** User scripts run without access to the trusted controller's files or credentials. */
export async function runCommand(
  id: string,
  command: string,
  args: string[],
  options: SpawnOptions = {},
): Promise<void> {
  const image = process.env.BUILD_SANDBOX_IMAGE;
  const hostDataDir = process.env.BUILD_HOST_DATA_DIR;
  const cwd = path.resolve(String(options.cwd ?? ''));
  const relative = path.relative(CONFIG.paths.buildsRoot, cwd);
  if (relative.startsWith('..') || path.isAbsolute(relative) || !relative) throw new Error('Invalid build directory.');
  if (process.env.NODE_ENV === 'production' && (!image || !hostDataDir)) {
    throw Object.assign(new Error('The isolated builder is unavailable. Please retry or upload prebuilt static assets.'), { code: 'sandbox_unavailable' });
  }
  const sandbox = Boolean(image && hostDataDir);
  const name = `gemigo-build-${id}`;
  if (sandbox) {
    const chown = async (directory: string): Promise<void> => {
      await fs.promises.chown(directory, 1000, 1000);
      for (const entry of await fs.promises.readdir(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) await chown(file);
        else if (entry.isFile()) await fs.promises.chown(file, 1000, 1000);
      }
    };
    await chown(cwd);
  }
  const dockerArgs = ['run', '--rm', '--name', name, '--memory', '512m', '--cpus', '1', '--pids-limit', '128',
    '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--read-only', '--user', '1000:1000',
    '--tmpfs', '/tmp:rw,nosuid,size=268435456', '--workdir', '/workspace',
    '--mount', `type=bind,src=${path.join(hostDataDir ?? '', 'builds', relative)},dst=/workspace`,
    '-e', 'HOME=/tmp', '-e', 'COREPACK_HOME=/tmp/corepack', '-e', 'COREPACK_ENABLE_DOWNLOAD_PROMPT=0',
    '-e', 'npm_config_cache=/tmp/npm', '-e', 'npm_config_production=false', image ?? '', command, ...args];
  const cleanEnv = { PATH: process.env.PATH, HOME: process.env.HOME, npm_config_production: 'false' };
  const cleanup = (): Promise<void> => !sandbox ? Promise.resolve() : new Promise(resolve => {
    execFile('docker', ['rm', '-f', name], { env: { PATH: process.env.PATH }, timeout: 10000 }, () => resolve());
  });
  try {
    await new Promise<void>((resolve, reject) => {
      appendLog(id, `$ ${command} ${args.join(' ')}`, 'info');
      const child = spawn(sandbox ? 'docker' : command, sandbox ? dockerArgs : args, {
        cwd: sandbox ? undefined : cwd, shell: false, detached: process.platform !== 'win32',
        env: sandbox ? { PATH: process.env.PATH } : cleanEnv,
      });
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        void cleanup();
        try { process.kill(process.platform === 'win32' ? child.pid! : -child.pid!, 'SIGTERM'); } catch { child.kill(); }
        setTimeout(() => {
          try { process.kill(process.platform === 'win32' ? child.pid! : -child.pid!, 'SIGKILL'); } catch { /* already exited */ }
        }, 5000).unref();
      }, 5 * 60 * 1000);
      for (const [stream, level] of [[child.stdout, 'info'], [child.stderr, 'warning']] as const) {
        stream?.on('data', data => {
          for (const line of data.toString().split(/\r?\n/).filter(Boolean)) appendLog(id, stripAnsi(line), level);
        });
      }
      child.on('error', err => { clearTimeout(timeout); reject(Object.assign(new Error(`Could not start ${command}. Upload prebuilt assets or use npm, pnpm, or yarn.`), { code: 'package_manager_unavailable', cause: err })); });
      child.on('close', code => {
        clearTimeout(timeout);
        if (code === 0 && !timedOut) resolve();
        else reject(Object.assign(new Error(timedOut ? 'Install/build exceeded five minutes. Please reduce dependencies or upload prebuilt static assets.' : `Command "${command}" exited with code ${code}. Check the preceding build log.`), { code: timedOut ? 'build_timeout' : 'command_failed' }));
      });
    });
  } finally { await cleanup(); }
}

export async function deployToLocalStatic(opts: {
  deploymentId: string;
  slug: string;
  distPath: string;
}): Promise<string> {
  const { deploymentId, slug, distPath } = opts;
  const outputDir = path.join(CONFIG.paths.staticRoot, slug);

  appendLog(
    deploymentId,
    `Copying build output to local static dir: ${outputDir}`,
    'info',
  );
  await fs.promises.rm(outputDir, { recursive: true, force: true });
  await copyDir(distPath, outputDir);

  return `/apps/${slug}/`;
}
