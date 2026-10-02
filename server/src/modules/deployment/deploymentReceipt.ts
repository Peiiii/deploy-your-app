import * as fs from 'node:fs';
import * as path from 'node:path';
import { CONFIG } from '../../common/config/config.js';
import type { DeploymentRecord, DeploymentStatus, BuildLog } from '../../common/types.js';

export interface DeploymentReceipt {
  type: 'status';
  status: DeploymentStatus;
  stage: string;
  buildMode?: 'static' | 'build';
  errorCode?: string;
  errorMessage?: string;
  projectMetadata?: Record<string, unknown>;
  logs: BuildLog[];
  updatedAt: string;
}

const receiptDir = path.join(CONFIG.paths.dataDir, 'deployments');
fs.mkdirSync(receiptDir, { recursive: true });
const terminal = (status: string) => status === 'SUCCESS' || status === 'FAILED';
const receiptPath = (id: string) =>
  /^[a-f0-9-]{36}$/i.test(id) ? path.join(receiptDir, `${id}.json`) : null;

function writeReceipt(file: string, receipt: DeploymentReceipt): void {
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(receipt), { mode: 0o600 });
  fs.renameSync(temp, file);
}

export function saveDeploymentReceipt(id: string, record: DeploymentRecord): void {
  const file = receiptPath(id);
  if (!file) throw new Error('Invalid deployment identity');
  writeReceipt(file, {
    type: 'status',
    status: record.status,
    stage: record.stage ?? 'queued',
    buildMode: record.buildMode,
    errorCode: record.errorCode,
    errorMessage: record.errorMessage?.slice(0, 2000),
    projectMetadata: record.projectMetadata,
    logs: record.logs.slice(-500),
    updatedAt: new Date().toISOString(),
  });
}

export function readDeploymentReceipt(id: string): DeploymentReceipt | null {
  const file = receiptPath(id);
  if (!file || !fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as DeploymentReceipt;
}

export function recoverDeploymentReceipts(recoverInterrupted = true): void {
  for (const filename of fs.readdirSync(receiptDir)) {
    if (!filename.endsWith('.json')) continue;
    const file = path.join(receiptDir, filename);
    try {
      const receipt = JSON.parse(fs.readFileSync(file, 'utf8')) as DeploymentReceipt;
      if (Date.parse(receipt.updatedAt) < Date.now() - 30 * 86400000) {
        fs.unlinkSync(file);
      } else if (recoverInterrupted && !terminal(receipt.status)) {
        receipt.status = 'FAILED';
        receipt.errorCode = 'server_restarted';
        receipt.errorMessage =
          'The deployment service restarted before completion. Please deploy again.';
        receipt.updatedAt = new Date().toISOString();
        writeReceipt(file, receipt);
      }
    } catch {
      console.warn('Ignoring unreadable deployment receipt', filename);
    }
  }
}

// Expire old receipts even when the service runs continuously.
setInterval(() => recoverDeploymentReceipts(false), 86400000).unref();
