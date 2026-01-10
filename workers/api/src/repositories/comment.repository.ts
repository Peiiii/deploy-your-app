import type { ProjectComment } from '../types/comment';
import { authRepository } from './auth.repository';

type CommentRow = {
  id: string;
  project_id: string;
  user_id: string;
  content: string;
  reply_to_comment_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  user_handle: string | null;
  user_display_name: string | null;
  user_avatar_url: string | null;
  reply_user_id: string | null;
  reply_user_handle: string | null;
  reply_user_display_name: string | null;
};

let commentSchemaEnsured = false;

class CommentRepository {
  private async ensureSchema(db: D1Database): Promise<void> {
    if (commentSchemaEnsured) return;

    // Comments need to join author info from users table even for public reads.
    await authRepository.ensureAuthSchema(db);

    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS project_comments (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          content TEXT NOT NULL,
          reply_to_comment_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT
        )`,
      )
      .run();

    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_project_comments_project_created
         ON project_comments(project_id, created_at DESC)`,
      )
      .run();

    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_project_comments_user_created
         ON project_comments(user_id, created_at DESC)`,
      )
      .run();

    // Backfill reply_to_comment_id for older databases (best-effort).
    try {
      await db
        .prepare(`ALTER TABLE project_comments ADD COLUMN reply_to_comment_id TEXT`)
        .run();
    } catch {
      // ignore
    }

    // Backfill deleted_at for older databases (best-effort).
    try {
      await db
        .prepare(`ALTER TABLE project_comments ADD COLUMN deleted_at TEXT`)
        .run();
    } catch {
      // ignore
    }

    commentSchemaEnsured = true;
  }

  async getLatestCommentTimestampForUser(
    db: D1Database,
    userId: string,
  ): Promise<string | null> {
    await this.ensureSchema(db);
    const row = await db
      .prepare(
        `SELECT created_at
         FROM project_comments
         WHERE user_id = ? AND deleted_at IS NULL
         ORDER BY created_at DESC
         LIMIT 1`,
      )
      .bind(userId)
      .first<{ created_at: string }>();
    return row?.created_at ?? null;
  }

  async findCommentForReplyValidation(
    db: D1Database,
    input: { commentId: string; projectId: string },
  ): Promise<{ id: string; userId: string } | null> {
    await this.ensureSchema(db);
    const row = await db
      .prepare(
        `SELECT id, user_id
         FROM project_comments
         WHERE id = ? AND project_id = ? AND deleted_at IS NULL
         LIMIT 1`,
      )
      .bind(input.commentId, input.projectId)
      .first<{ id: string; user_id: string }>();
    if (!row) return null;
    return { id: String(row.id), userId: String(row.user_id) };
  }

  async insertComment(
    db: D1Database,
    input: {
      id: string;
      projectId: string;
      userId: string;
      content: string;
      replyToCommentId: string | null;
    },
  ): Promise<void> {
    await this.ensureSchema(db);
    const now = new Date().toISOString();
    await db
      .prepare(
        `INSERT INTO project_comments (
          id, project_id, user_id, content, reply_to_comment_id,
          created_at, updated_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
      )
      .bind(
        input.id,
        input.projectId,
        input.userId,
        input.content,
        input.replyToCommentId,
        now,
        now,
      )
      .run();
  }

  async getCommentById(
    db: D1Database,
    commentId: string,
  ): Promise<ProjectComment | null> {
    await this.ensureSchema(db);
    const row = await db
      .prepare(
        `SELECT
          c.id,
          c.project_id,
          c.user_id,
          c.content,
          c.reply_to_comment_id,
          c.created_at,
          c.updated_at,
          c.deleted_at,
          u.handle as user_handle,
          u.display_name as user_display_name,
          u.avatar_url as user_avatar_url,
          parent.user_id as reply_user_id,
          pu.handle as reply_user_handle,
          pu.display_name as reply_user_display_name
         FROM project_comments c
         LEFT JOIN users u ON u.id = c.user_id
         LEFT JOIN project_comments parent ON parent.id = c.reply_to_comment_id
         LEFT JOIN users pu ON pu.id = parent.user_id
         WHERE c.id = ?
         LIMIT 1`,
      )
      .bind(commentId)
      .first<CommentRow>();

    if (!row) return null;
    if (row.deleted_at) return null;

    return {
      id: String(row.id),
      projectId: String(row.project_id),
      content: String(row.content ?? ''),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      author: {
        id: String(row.user_id),
        handle: row.user_handle ?? null,
        displayName: row.user_display_name ?? null,
        avatarUrl: row.user_avatar_url ?? null,
      },
      replyTo: row.reply_to_comment_id
        ? {
            commentId: String(row.reply_to_comment_id),
            userId: row.reply_user_id ? String(row.reply_user_id) : null,
            handle: row.reply_user_handle ?? null,
            displayName: row.reply_user_display_name ?? null,
          }
        : null,
      canDelete: false,
    };
  }

  async countCommentsForProject(
    db: D1Database,
    projectId: string,
  ): Promise<number> {
    await this.ensureSchema(db);
    const row = await db
      .prepare(
        `SELECT COUNT(*) as cnt
         FROM project_comments
         WHERE project_id = ? AND deleted_at IS NULL`,
      )
      .bind(projectId)
      .first<{ cnt: number }>();
    return row?.cnt ?? 0;
  }

  async listCommentsForProject(
    db: D1Database,
    projectId: string,
    input: { offset: number; limit: number },
  ): Promise<ProjectComment[]> {
    await this.ensureSchema(db);
    const result = await db
      .prepare(
        `SELECT
          c.id,
          c.project_id,
          c.user_id,
          c.content,
          c.reply_to_comment_id,
          c.created_at,
          c.updated_at,
          c.deleted_at,
          u.handle as user_handle,
          u.display_name as user_display_name,
          u.avatar_url as user_avatar_url,
          parent.user_id as reply_user_id,
          pu.handle as reply_user_handle,
          pu.display_name as reply_user_display_name
         FROM project_comments c
         LEFT JOIN users u ON u.id = c.user_id
         LEFT JOIN project_comments parent ON parent.id = c.reply_to_comment_id
         LEFT JOIN users pu ON pu.id = parent.user_id
         WHERE c.project_id = ? AND c.deleted_at IS NULL
         ORDER BY c.created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(projectId, input.limit, input.offset)
      .all<CommentRow>();

    const rows = result.results ?? [];
    return rows.map((row) => ({
      id: String(row.id),
      projectId: String(row.project_id),
      content: String(row.content ?? ''),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      author: {
        id: String(row.user_id),
        handle: row.user_handle ?? null,
        displayName: row.user_display_name ?? null,
        avatarUrl: row.user_avatar_url ?? null,
      },
      replyTo: row.reply_to_comment_id
        ? {
            commentId: String(row.reply_to_comment_id),
            userId: row.reply_user_id ? String(row.reply_user_id) : null,
            handle: row.reply_user_handle ?? null,
            displayName: row.reply_user_display_name ?? null,
          }
        : null,
      canDelete: false,
    }));
  }

  async getCommentOwner(
    db: D1Database,
    commentId: string,
  ): Promise<{ userId: string } | null> {
    await this.ensureSchema(db);
    const row = await db
      .prepare(`SELECT user_id FROM project_comments WHERE id = ? LIMIT 1`)
      .bind(commentId)
      .first<{ user_id: string }>();
    if (!row) return null;
    return { userId: String(row.user_id) };
  }

  async softDeleteComment(
    db: D1Database,
    commentId: string,
  ): Promise<void> {
    await this.ensureSchema(db);
    const now = new Date().toISOString();
    await db
      .prepare(
        `UPDATE project_comments
         SET deleted_at = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(now, now, commentId)
      .run();
  }
}

export const commentRepository = new CommentRepository();
