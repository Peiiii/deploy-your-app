import type { SourceType } from '../types/project';

export type DeploymentAttemptStatus =
  | 'started'
  | 'accepted'
  | 'succeeded'
  | 'failed'
  | 'rejected';

export interface CreateDeploymentAttemptInput {
  id: string;
  projectId: string;
  ownerId: string;
  flowId?: string;
  sourceType: SourceType;
  clientChannel: 'web' | 'desktop' | 'extension' | 'cli' | 'api';
  fileExtension?: string;
  payloadBytes?: number;
  startedAt: string;
}

let deploymentSchemaEnsured = false;

export interface AcceptedDeployment {
  id: string;
  project_id: string;
  provider_deployment_id: string;
  started_at: string;
  status: DeploymentAttemptStatus;
}

class DeploymentRepository {
  findByProviderId = async (db: D1Database, providerId: string): Promise<AcceptedDeployment | null> => {
    await this.ensureSchema(db);
    return db.prepare(`SELECT id, project_id, provider_deployment_id, started_at, status
      FROM deployment_attempts WHERE provider_deployment_id = ? ORDER BY started_at DESC LIMIT 1`)
      .bind(providerId).first<AcceptedDeployment>();
  };

  isLatest = async (db: D1Database, attempt: AcceptedDeployment): Promise<boolean> => {
    const row = await db.prepare(`SELECT id FROM deployment_attempts
      WHERE project_id = ? ORDER BY started_at DESC, rowid DESC LIMIT 1`)
      .bind(attempt.project_id).first<{ id: string }>();
    return row?.id === attempt.id;
  };

  listPending = async (db: D1Database): Promise<AcceptedDeployment[]> => {
    await this.ensureSchema(db);
    const rows = await db.prepare(`SELECT a.id, a.project_id, a.provider_deployment_id, a.started_at, a.status
      FROM deployment_attempts a WHERE a.status = 'accepted' AND a.provider_deployment_id IS NOT NULL
      AND julianday(a.started_at) > julianday('now', '-1 day')
      AND a.id = (SELECT b.id FROM deployment_attempts b WHERE b.project_id = a.project_id
        ORDER BY b.started_at DESC, b.rowid DESC LIMIT 1)
      ORDER BY a.started_at DESC LIMIT 20`)
      .all<AcceptedDeployment>();
    return rows.results;
  };

  private ensureSchema = async (db: D1Database): Promise<void> => {
    if (deploymentSchemaEnsured) return;
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS deployment_attempts (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          owner_id TEXT NOT NULL,
          provider_deployment_id TEXT,
          flow_id TEXT,
          source_type TEXT NOT NULL,
          client_channel TEXT NOT NULL,
          file_extension TEXT,
          payload_bytes INTEGER,
          status TEXT NOT NULL,
          error_code TEXT,
          started_at TEXT NOT NULL,
          accepted_at TEXT,
          finished_at TEXT,
          duration_ms INTEGER
        )`,
      )
      .run();
    await db
      .prepare(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_deployment_attempts_flow
         ON deployment_attempts(flow_id) WHERE flow_id IS NOT NULL`,
      )
      .run();
    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_deployment_attempts_project_started
         ON deployment_attempts(project_id, started_at DESC)`,
      )
      .run();
    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_deployment_attempts_started_status
         ON deployment_attempts(started_at, status)`,
      )
      .run();
    deploymentSchemaEnsured = true;
  };

  createAttempt = async (
    db: D1Database,
    input: CreateDeploymentAttemptInput,
  ): Promise<void> => {
    await this.ensureSchema(db);
    await db
      .prepare(
        `INSERT INTO deployment_attempts (
          id, project_id, owner_id, flow_id, source_type, client_channel,
          file_extension, payload_bytes, status, started_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'started', ?)`,
      )
      .bind(
        input.id,
        input.projectId,
        input.ownerId,
        input.flowId ?? null,
        input.sourceType,
        input.clientChannel,
        input.fileExtension ?? null,
        input.payloadBytes ?? null,
        input.startedAt,
      )
      .run();
  };

  markAccepted = async (
    db: D1Database,
    id: string,
    providerDeploymentId: string,
    acceptedAt: string,
  ): Promise<void> => {
    await this.ensureSchema(db);
    await db
      .prepare(
        `UPDATE deployment_attempts
         SET status = 'accepted', provider_deployment_id = ?, accepted_at = ?
         WHERE id = ?`,
      )
      .bind(providerDeploymentId, acceptedAt, id)
      .run();
  };

  finishAttempt = async (
    db: D1Database,
    id: string,
    status: Extract<DeploymentAttemptStatus, 'succeeded' | 'failed' | 'rejected'>,
    finishedAt: string,
    durationMs: number,
    errorCode?: string,
  ): Promise<void> => {
    await this.ensureSchema(db);
    await db
      .prepare(
        `UPDATE deployment_attempts
         SET status = ?, finished_at = ?, duration_ms = ?, error_code = ?
         WHERE id = ?`,
      )
      .bind(status, finishedAt, durationMs, errorCode ?? null, id)
      .run();
  };

  finishAttemptByFlow = async (
    db: D1Database,
    projectId: string,
    flowId: string,
    status: Extract<DeploymentAttemptStatus, 'succeeded' | 'failed'>,
    finishedAt: string,
    errorCode?: string,
  ): Promise<void> => {
    await this.ensureSchema(db);
    await db
      .prepare(
        `UPDATE deployment_attempts
         SET status = ?, finished_at = ?,
             duration_ms = CAST((julianday(?) - julianday(started_at))*86400000 AS INTEGER),
             error_code = ?
         WHERE project_id = ? AND flow_id = ? AND status IN ('started','accepted')`,
      )
      .bind(status, finishedAt, finishedAt, errorCode ?? null, projectId, flowId)
      .run();
  };
}

export const deploymentRepository = new DeploymentRepository();
