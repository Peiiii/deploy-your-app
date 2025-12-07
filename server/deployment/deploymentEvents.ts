import {
  deployments,
  streams,
  type StreamClient,
} from '../state.js';
import type { DeploymentStatus, LogLevel, BuildLog } from '../types.js';

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
  const logEntry: BuildLog = { timestamp, message, level };
  deployment.logs.push(logEntry);
  broadcastEvent(id, { type: 'log', message, level });
}

export function updateStatus(
  id: string,
  status: DeploymentStatus,
  extra?: Record<string, unknown>,
): void {
  const deployment = deployments.get(id);
  if (!deployment) return;
  deployment.status = status;
  const payload =
    extra && Object.keys(extra).length > 0
      ? { type: 'status', status, ...extra }
      : { type: 'status', status };
  broadcastEvent(id, payload);
}
