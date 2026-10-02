import { saveDeploymentReceipt } from '../deploymentReceipt.js';
import {
  deployments,
  streams,
  type StreamClient,
} from '../state.js';
import type {
  DeploymentStatus,
  LogLevel,
  BuildLog,
} from '../../../common/types.js';

export function broadcastEvent(id: string, payload: unknown): void {
  const listeners = streams.get(id);
  if (!listeners) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of listeners as Set<StreamClient>) {
    res.write(data);
  }
}

export function appendLog(
  id: string,
  message: string,
  level: LogLevel = 'info',
): void {
  const deployment = deployments.get(id);
  if (!deployment) return;
  const timestamp = new Date().toISOString();
  const logEntry: BuildLog = { timestamp, message: message.slice(0, 4000), level };
  deployment.logs.push(logEntry);
  if (deployment.logs.length > 500) deployment.logs.shift();
  broadcastEvent(id, { type: 'log', message: logEntry.message, level });
}

export function updateStatus(
  id: string,
  status: DeploymentStatus,
  extra?: Record<string, unknown>,
): void {
  const deployment = deployments.get(id);
  if (!deployment) return;
  deployment.status = status;
  if (extra) Object.assign(deployment, extra);
  saveDeploymentReceipt(id, deployment);
  const payload =
    extra && Object.keys(extra).length > 0
      ? { type: 'status', status, ...extra }
      : { type: 'status', status };
  broadcastEvent(id, payload);
}

export function setDeploymentStage(id: string, stage: string, buildMode?: 'static' | 'build'): void {
  const record = deployments.get(id);
  if (!record) return;
  record.stage = stage;
  if (buildMode) record.buildMode = buildMode;
  saveDeploymentReceipt(id, record);
}
