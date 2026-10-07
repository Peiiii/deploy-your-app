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
  providerDeploymentId?: string;
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
  owner_id?: string;
  stage?: string;
  build_mode?: string;
  error_message?: string;
  error_code?: string;
  result_url?: string;
  finished_at?: string;
}

class DeploymentRepository {
  updateProgress = async (db: D1Database, id: string, stage: string): Promise<void> => {
    await db.prepare("UPDATE deployment_attempts SET stage = ?, build_mode = 'static' WHERE id = ? AND status IN ('started','accepted')").bind(stage, id).run();
  };

  findByProviderId = async (db: D1Database, providerId: string): Promise<AcceptedDeployment | null> => {
    await this.ensureSchema(db);
    return db.prepare(`SELECT id, project_id, owner_id, provider_deployment_id, started_at, status, stage, build_mode, error_message, error_code, result_url
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
      FROM deployment_attempts a WHERE a.status IN ('started', 'accepted') AND a.provider_deployment_id IS NOT NULL
      ORDER BY a.started_at ASC LIMIT 20`)
      .all<AcceptedDeployment>();
    return rows.results;
  };

  findByFlow = async (db: D1Database, flowId: string): Promise<AcceptedDeployment | null> => {
    await this.ensureSchema(db);
    return db.prepare('SELECT id, project_id, owner_id, provider_deployment_id, started_at, status FROM deployment_attempts WHERE flow_id = ?')
      .bind(flowId).first<AcceptedDeployment>();
  };

  latestForProject = async (db: D1Database, projectId: string): Promise<AcceptedDeployment | null> => {
    await this.ensureSchema(db);
    return db.prepare('SELECT id, project_id, provider_deployment_id, started_at, finished_at, status, stage, build_mode, error_message, error_code FROM deployment_attempts WHERE project_id = ? ORDER BY started_at DESC, rowid DESC LIMIT 1')
      .bind(projectId).first<AcceptedDeployment>();
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
    const columns = await db.prepare('PRAGMA table_info(deployment_attempts)').all<{ name: string }>();
    for (const name of ['stage', 'build_mode', 'error_message', 'result_url']) {
      if (!columns.results.some(column => column.name === name)) {
        await db.prepare(`ALTER TABLE deployment_attempts ADD COLUMN ${name} TEXT`).run().catch(error => {
          if (!String(error).includes('duplicate column')) throw error;
        });
      }
    }
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
          file_extension, payload_bytes, status, started_at, provider_deployment_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'started', ?, ?)`,
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
        input.providerDeploymentId ?? null,
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
    detail?: { stage?: string; buildMode?: string; errorMessage?: string; projectMetadata?: { url?: string } },
  ): Promise<void> => {
    await this.ensureSchema(db);
    await db
      .prepare(
        `UPDATE deployment_attempts
         SET status = ?, finished_at = ?, duration_ms = ?, error_code = ?, stage = ?, build_mode = ?, error_message = ?, result_url = ?
         WHERE id = ?`,
      )
      .bind(status, finishedAt, durationMs, errorCode ?? null, detail?.stage ?? null, detail?.buildMode ?? null, detail?.errorMessage?.slice(0, 2000) ?? null, detail?.projectMetadata?.url ?? null, id)
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
