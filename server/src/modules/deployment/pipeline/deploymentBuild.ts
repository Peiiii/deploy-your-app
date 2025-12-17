import * as path from 'path';
import * as fs from 'fs';
import { spawn, SpawnOptions } from 'child_process';
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

export function runCommand(
  id: string,
  command: string,
  args: string[],
  options: SpawnOptions = {},
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    appendLog(id, `$ ${command} ${args.join(' ')}`, 'info');

    const child = spawn(command, args, {
      ...options,
      shell: false,
      env: { ...process.env, ...(options.env || {}) },
    });

    if (child.stdout) {
      child.stdout.on('data', (data) => {
        const lines = data.toString().split(/\r?\n/).filter(Boolean);
        for (const line of lines) {
          const cleanLine = stripAnsi(line);
          appendLog(id, cleanLine, 'info');
        }
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data) => {
        const lines = data.toString().split(/\r?\n/).filter(Boolean);
        for (const line of lines) {
          const cleanLine = stripAnsi(line);
          appendLog(id, cleanLine, 'warning');
        }
      });
    }

    child.on('error', (err) => {
      appendLog(id, `Command failed: ${String(err)}`, 'error');
      reject(err);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        const error = new Error(`Command "${command}" exited with code ${code}`);
        appendLog(id, error.message, 'error');
        reject(error);
      }
    });
  });
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
