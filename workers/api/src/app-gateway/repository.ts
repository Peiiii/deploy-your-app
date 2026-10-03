import type { ConnectionConfig } from './config';
import { RateLimitError, UnauthorizedError } from '../utils/error-handler';
import { ticketHash, type EncryptedSecret } from './vault';

export interface SecretRow {
  project_id: string;
  name: string;
  ciphertext: string;
  key_version: string;
  version: number;
  updated_at: number;
}
export interface ConnectionRow {
  project_id: string;
  name: string;
  config: string;
  revision: number;
  updated_at: number;
}
export interface LeaseRow {
  id: string;
  project_id: string;
  connection_name: string;
  revision: number;
  secret_version: number;
  subject: string;
  origin: string;
  expires_at: number;
  consumed_at: number | null;
  status: string;
}

export class GatewayRepository {
  constructor(
    private db: D1Database,
    readonly projectId: string
  ) {}

  async list(): Promise<{
    secrets: { name: string; version: number; updatedAt: number }[];
    connections: (ConnectionConfig & { revision: number; updatedAt: number })[];
  }> {
    const [secrets, connections] = await Promise.all([
      this.db
        .prepare(
          'SELECT name, version, updated_at FROM app_secrets WHERE project_id = ? ORDER BY name'
        )
        .bind(this.projectId)
        .all<SecretRow>(),
      this.db
        .prepare('SELECT * FROM app_connections WHERE project_id = ? ORDER BY name')
        .bind(this.projectId)
        .all<ConnectionRow>(),
    ]);
    return {
      secrets: secrets.results.map((r) => ({
        name: r.name,
        version: r.version,
        updatedAt: r.updated_at,
      })),
      connections: connections.results.map((r) => ({
        ...JSON.parse(r.config),
        revision: r.revision,
        updatedAt: r.updated_at,
      })),
    };
  }
  secret(name: string): Promise<SecretRow | null> {
    return this.db
      .prepare('SELECT * FROM app_secrets WHERE project_id = ? AND name = ?')
      .bind(this.projectId, name)
      .first<SecretRow>();
  }
  connection(name: string): Promise<ConnectionRow | null> {
    return this.db
      .prepare('SELECT * FROM app_connections WHERE project_id = ? AND name = ?')
      .bind(this.projectId, name)
      .first<ConnectionRow>();
  }

  async saveSecret(name: string, encrypted: EncryptedSecret, version: number): Promise<void> {
    // Compare-and-swap prevents two concurrent rotations from binding different ciphertext to one version.
    const saved = await this.db
      .prepare(
        `INSERT INTO app_secrets(project_id,name,ciphertext,key_version,version,updated_at) VALUES(?,?,?,?,?,?)
      ON CONFLICT(project_id,name) DO UPDATE SET ciphertext=excluded.ciphertext,key_version=excluded.key_version,version=excluded.version,updated_at=excluded.updated_at
      WHERE app_secrets.version=excluded.version-1 RETURNING name`
      )
      .bind(this.projectId, name, encrypted.ciphertext, encrypted.keyVersion, version, Date.now())
      .first();
    if (!saved) throw new RateLimitError('The Secret changed concurrently. Reload and try again.');
    await this.revokeSecret(name);
  }
  async revokeSecret(name: string): Promise<void> {
    await this.db
      .prepare(
        `UPDATE app_gateway_leases SET status='revoked',ended_at=? WHERE project_id=? AND status IN ('reserved','active')
      AND connection_name IN (SELECT name FROM app_connections WHERE project_id=? AND json_extract(config,'$.secretName')=?)`
      )
      .bind(Date.now(), this.projectId, this.projectId, name)
      .run();
  }
  async deleteSecret(name: string): Promise<void> {
    await this.db.batch([
      this.db
        .prepare(
          `UPDATE app_gateway_leases SET status='revoked',ended_at=? WHERE project_id=? AND status IN ('reserved','active') AND connection_name IN (SELECT name FROM app_connections WHERE project_id=? AND json_extract(config,'$.secretName')=?)`
        )
        .bind(Date.now(), this.projectId, this.projectId, name),
      this.db
        .prepare('DELETE FROM app_secrets WHERE project_id=? AND name=?')
        .bind(this.projectId, name),
    ]);
  }
  async saveConnection(config: ConnectionConfig): Promise<void> {
    await this.db.batch([
      this.db
        .prepare(
          `INSERT INTO app_connections(project_id,name,config,updated_at) VALUES(?,?,?,?) ON CONFLICT(project_id,name) DO UPDATE SET config=excluded.config,revision=app_connections.revision+1,updated_at=excluded.updated_at`
        )
        .bind(this.projectId, config.name, JSON.stringify(config), Date.now()),
      this.db
        .prepare(
          `UPDATE app_gateway_leases SET status='revoked',ended_at=? WHERE project_id=? AND connection_name=? AND status IN ('reserved','active')`
        )
        .bind(Date.now(), this.projectId, config.name),
    ]);
  }

  async reserve(
    connection: ConnectionRow,
    secret: SecretRow,
    subject: string,
    origin: string
  ): Promise<{ id: string; ticket: string; expiresAt: number }> {
    const config: ConnectionConfig = JSON.parse(connection.config);
    const now = Date.now();
    const day = Math.floor((now + 8 * 3600000) / 86400000) * 86400000 - 8 * 3600000;
    const id = crypto.randomUUID();
    const ticket = crypto.randomUUID() + crypto.randomUUID();
    const expiresAt = now + 60000 + config.limits.durationSeconds * 1000;
    const saved = await this.db
      .prepare(
        `INSERT INTO app_gateway_leases(id,ticket_hash,project_id,connection_name,revision,secret_version,subject,origin,created_at,ticket_expires_at,expires_at)
      SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE
      EXISTS(SELECT 1 FROM app_connections WHERE project_id=? AND name=? AND revision=? AND json_extract(config,'$.enabled')=1)
      AND EXISTS(SELECT 1 FROM app_secrets WHERE project_id=? AND name=? AND version=?)
      AND (SELECT COUNT(*) FROM app_gateway_leases WHERE project_id=? AND created_at>=?)<?
      AND (SELECT COUNT(*) FROM app_gateway_leases WHERE project_id=? AND subject=? AND created_at>=?)<?
      AND (SELECT COUNT(*) FROM app_gateway_leases WHERE project_id=? AND ((status='reserved' AND ticket_expires_at>?) OR (status='active' AND expires_at>?)))<?
      AND (SELECT COUNT(*) FROM app_gateway_leases WHERE project_id=? AND subject=? AND ((status='reserved' AND ticket_expires_at>?) OR (status='active' AND expires_at>?)))<? RETURNING id`
      )
      .bind(
        id,
        await ticketHash(ticket),
        this.projectId,
        connection.name,
        connection.revision,
        secret.version,
        subject,
        origin,
        now,
        now + 60000,
        expiresAt,
        this.projectId,
        connection.name,
        connection.revision,
        this.projectId,
        secret.name,
        secret.version,
        this.projectId,
        day,
        config.limits.appDaily,
        this.projectId,
        subject,
        day,
        config.limits.userDaily,
        this.projectId,
        now,
        now,
        config.limits.concurrency,
        this.projectId,
        subject,
        now,
        now,
        config.limits.userConcurrency
      )
      .first();
    if (!saved)
      throw new RateLimitError(
        'Daily quota or concurrency limit reached, or the connection changed.'
      );
    return { id, ticket, expiresAt: now + 60000 };
  }

  async consume(ticket: string, name: string, origin: string): Promise<LeaseRow> {
    const now = Date.now();
    const row = await this.db
      .prepare(
        `UPDATE app_gateway_leases SET status='active',consumed_at=? WHERE ticket_hash=? AND project_id=? AND connection_name=? AND origin=?
      AND status='reserved' AND ticket_expires_at>? AND expires_at>? RETURNING *`
      )
      .bind(now, await ticketHash(ticket), this.projectId, name, origin, now, now)
      .first<LeaseRow>();
    if (!row) throw new UnauthorizedError('Invalid, expired or already used connection ticket.');
    return row;
  }
  async finish(id: string): Promise<void> {
    await this.db
      .prepare(
        `UPDATE app_gateway_leases SET status='ended',ended_at=? WHERE id=? AND project_id=? AND status IN ('reserved','active')`
      )
      .bind(Date.now(), id, this.projectId)
      .run();
  }
  async usage(): Promise<{ requests: number; active: number }> {
    const now = Date.now();
    const day = Math.floor((now + 8 * 3600000) / 86400000) * 86400000 - 8 * 3600000;
    const row = await this.db
      .prepare(
        `SELECT SUM(CASE WHEN created_at>=? THEN 1 ELSE 0 END) AS requests,SUM(CASE WHEN ((status='reserved' AND ticket_expires_at>?) OR (status='active' AND expires_at>?)) THEN 1 ELSE 0 END) AS active FROM app_gateway_leases WHERE project_id=?`
      )
      .bind(day, now, now, this.projectId)
      .first<{ requests: number; active: number }>();
    return { requests: row?.requests || 0, active: row?.active || 0 };
  }
}
