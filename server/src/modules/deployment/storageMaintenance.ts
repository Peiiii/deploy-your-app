import * as fs from 'node:fs';
import * as path from 'node:path';
import { CONFIG } from '../../common/config/config.js';

export interface StorageMaintenanceJob {
  projectId: string;
  slug: string;
  deleted: boolean;
  complete: boolean;
}

const directory = path.join(CONFIG.paths.dataDir, 'storage-maintenance');
fs.mkdirSync(directory, { recursive: true });

function fileFor(projectId: string): string {
  if (!/^[a-f0-9-]{36}$/i.test(projectId)) throw new Error('Invalid project identity.');
  return path.join(directory, `${projectId}.json`);
}

export function readStorageJob(projectId: string): StorageMaintenanceJob | null {
  const file = fileFor(projectId);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

export function saveStorageJob(job: StorageMaintenanceJob): void {
  if (!/^[a-z0-9-]{1,63}$/.test(job.slug)) throw new Error('Invalid app address.');
  const file = fileFor(job.projectId);
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(job), { mode: 0o600 });
  fs.renameSync(temporary, file);
}

export function pendingStorageJobs(): StorageMaintenanceJob[] {
  const jobs: StorageMaintenanceJob[] = [];
  for (const name of fs.readdirSync(directory).filter(name => name.endsWith('.json'))) {
    try {
      const job = JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8')) as StorageMaintenanceJob;
      if (!job.complete) jobs.push(job);
    } catch { console.warn('Unreadable storage maintenance receipt; other cleanups will continue.'); }
  }
  return jobs;
}

export function finishStorageJob(job: StorageMaintenanceJob): void {
  if (!job.deleted && readStorageJob(job.projectId)?.deleted) return;
  // Keep deleted identities so late jobs and retries cannot touch a reused slug.
  if (job.deleted) saveStorageJob({ ...job, complete: true });
  else fs.unlinkSync(fileFor(job.projectId));
}
