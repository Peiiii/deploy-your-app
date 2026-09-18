import { authRepository } from './auth.repository';
import type {
  CommunityAuthor,
  FeedbackCategory,
  FeedbackComment,
  FeedbackPost,
  FeedbackStatus,
} from '../types/community';

interface FeedbackPostRow {
  id: string;
  user_id: string;
  title: string;
  content: string;
  category: FeedbackCategory;
  status: FeedbackStatus;
  created_at: string;
  updated_at: string;
  user_handle: string | null;
  user_display_name: string | null;
  user_avatar_url: string | null;
  comments_count: number;
}

interface FeedbackCommentRow {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user_handle: string | null;
  user_display_name: string | null;
  user_avatar_url: string | null;
}

let communitySchemaEnsured = false;

class CommunityRepository {
  private ensureSchema = async (db: D1Database): Promise<void> => {
    if (communitySchemaEnsured) return;

    await authRepository.ensureAuthSchema(db);

    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS community_feedback_posts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      )`
      )
      .run();

    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_community_feedback_posts_created
       ON community_feedback_posts(created_at DESC)`
      )
      .run();

    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_community_feedback_posts_status_category
       ON community_feedback_posts(status, category, created_at DESC)`
      )
      .run();

    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS community_feedback_votes (
        post_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (post_id, user_id)
      )`
      )
      .run();

    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_community_feedback_votes_post
       ON community_feedback_votes(post_id)`
      )
      .run();

    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS community_feedback_comments (
        id TEXT PRIMARY KEY,
        post_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      )`
      )
      .run();

    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_community_feedback_comments_post_created
       ON community_feedback_comments(post_id, created_at ASC)`
      )
      .run();

    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_community_feedback_comments_user_created
       ON community_feedback_comments(user_id, created_at DESC)`
      )
      .run();

    communitySchemaEnsured = true;
  };

  private mapAuthor = (row: {
    user_id: string;
    user_handle: string | null;
    user_display_name: string | null;
    user_avatar_url: string | null;
  }): CommunityAuthor => ({
    id: String(row.user_id),
    handle: row.user_handle ?? null,
    displayName: row.user_display_name ?? null,
    avatarUrl: row.user_avatar_url ?? null,
  });

  private mapPost = (row: FeedbackPostRow): FeedbackPost => ({
    id: String(row.id),
    title: String(row.title),
    content: String(row.content),
    category: row.category,
    status: row.status,
    commentsCount: Number(row.comments_count ?? 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    author: this.mapAuthor(row),
    canDelete: false,
    canUpdateStatus: false,
  });

  private mapComment = (row: FeedbackCommentRow): FeedbackComment => ({
    id: String(row.id),
    postId: String(row.post_id),
    content: String(row.content),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    author: this.mapAuthor(row),
    canDelete: false,
  });

  listPosts = async (
    db: D1Database,
    input: {
      ownerId: string | null;
      category: FeedbackCategory | null;
      status: FeedbackStatus | null;
      offset: number;
      limit: number;
    }
  ): Promise<{ items: FeedbackPost[]; total: number }> => {
    await this.ensureSchema(db);

    const conditions = ['p.deleted_at IS NULL'];
    const filterValues: string[] = [];
    if (input.ownerId) {
      conditions.push('p.user_id = ?');
      filterValues.push(input.ownerId);
    }
    if (input.category) {
      conditions.push('p.category = ?');
      filterValues.push(input.category);
    }
    if (input.status) {
      conditions.push('p.status = ?');
      filterValues.push(input.status);
    }
    const where = conditions.join(' AND ');

    const [countRow, result] = await Promise.all([
      db
        .prepare(
          `SELECT COUNT(*) AS cnt
         FROM community_feedback_posts p
         WHERE ${where}`
        )
        .bind(...filterValues)
        .first<{ cnt: number }>(),
      db
        .prepare(
          `SELECT
          p.id,
          p.user_id,
          p.title,
          p.content,
          p.category,
          p.status,
          p.created_at,
          p.updated_at,
          u.handle AS user_handle,
          u.display_name AS user_display_name,
          u.avatar_url AS user_avatar_url,
          (SELECT COUNT(*) FROM community_feedback_comments c WHERE c.post_id = p.id AND c.deleted_at IS NULL) AS comments_count
         FROM community_feedback_posts p
         LEFT JOIN users u ON u.id = p.user_id
         WHERE ${where}
         ORDER BY p.updated_at DESC, p.created_at DESC
         LIMIT ? OFFSET ?`
        )
        .bind(...filterValues, input.limit, input.offset)
        .all<FeedbackPostRow>(),
    ]);

    return {
      items: (result.results ?? []).map(this.mapPost),
      total: Number(countRow?.cnt ?? 0),
    };
  };

  getPostById = async (db: D1Database, postId: string): Promise<FeedbackPost | null> => {
    await this.ensureSchema(db);
    const row = await db
      .prepare(
        `SELECT
        p.id,
        p.user_id,
        p.title,
        p.content,
        p.category,
        p.status,
        p.created_at,
        p.updated_at,
        u.handle AS user_handle,
        u.display_name AS user_display_name,
        u.avatar_url AS user_avatar_url,
        (SELECT COUNT(*) FROM community_feedback_comments c WHERE c.post_id = p.id AND c.deleted_at IS NULL) AS comments_count
       FROM community_feedback_posts p
       LEFT JOIN users u ON u.id = p.user_id
       WHERE p.id = ? AND p.deleted_at IS NULL
       LIMIT 1`
      )
      .bind(postId)
      .first<FeedbackPostRow>();

    return row ? this.mapPost(row) : null;
  };

  createPost = async (
    db: D1Database,
    input: {
      id: string;
      userId: string;
      title: string;
      content: string;
      category: FeedbackCategory;
    }
  ): Promise<void> => {
    await this.ensureSchema(db);
    const now = new Date().toISOString();
    await db
      .prepare(
        `INSERT INTO community_feedback_posts (
        id, user_id, title, content, category, status,
        created_at, updated_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, 'open', ?, ?, NULL)`
      )
      .bind(input.id, input.userId, input.title, input.content, input.category, now, now)
      .run();
  };

  getLatestPostTimestampForUser = async (
    db: D1Database,
    userId: string
  ): Promise<string | null> => {
    await this.ensureSchema(db);
    const row = await db
      .prepare(
        `SELECT created_at
       FROM community_feedback_posts
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`
      )
      .bind(userId)
      .first<{ created_at: string }>();
    return row?.created_at ?? null;
  };

  updateStatus = async (db: D1Database, postId: string, status: FeedbackStatus): Promise<void> => {
    await this.ensureSchema(db);
    await db
      .prepare(
        `UPDATE community_feedback_posts
       SET status = ?, updated_at = ?
       WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(status, new Date().toISOString(), postId)
      .run();
  };

  softDeletePost = async (db: D1Database, postId: string): Promise<void> => {
    await this.ensureSchema(db);
    const now = new Date().toISOString();
    await db
      .prepare(
        `UPDATE community_feedback_posts
       SET deleted_at = ?, updated_at = ?
       WHERE id = ?`
      )
      .bind(now, now, postId)
      .run();
  };

  listComments = async (db: D1Database, postId: string): Promise<FeedbackComment[]> => {
    await this.ensureSchema(db);
    const result = await db
      .prepare(
        `SELECT
        c.id,
        c.post_id,
        c.user_id,
        c.content,
        c.created_at,
        c.updated_at,
        u.handle AS user_handle,
        u.display_name AS user_display_name,
        u.avatar_url AS user_avatar_url
       FROM community_feedback_comments c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.post_id = ? AND c.deleted_at IS NULL
       ORDER BY c.created_at ASC
       LIMIT 100`
      )
      .bind(postId)
      .all<FeedbackCommentRow>();
    return (result.results ?? []).map(this.mapComment);
  };

  createComment = async (
    db: D1Database,
    input: { id: string; postId: string; userId: string; content: string }
  ): Promise<void> => {
    await this.ensureSchema(db);
    const now = new Date().toISOString();
    await db.batch([
      db
        .prepare(
          `INSERT INTO community_feedback_comments (
          id, post_id, user_id, content, created_at, updated_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, NULL)`
        )
        .bind(input.id, input.postId, input.userId, input.content, now, now),
      db
        .prepare(
          `UPDATE community_feedback_posts
         SET updated_at = ?
         WHERE id = ? AND deleted_at IS NULL`
        )
        .bind(now, input.postId),
    ]);
  };

  getCommentById = async (db: D1Database, commentId: string): Promise<FeedbackComment | null> => {
    await this.ensureSchema(db);
    const row = await db
      .prepare(
        `SELECT
        c.id,
        c.post_id,
        c.user_id,
        c.content,
        c.created_at,
        c.updated_at,
        u.handle AS user_handle,
        u.display_name AS user_display_name,
        u.avatar_url AS user_avatar_url
       FROM community_feedback_comments c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.id = ? AND c.deleted_at IS NULL
       LIMIT 1`
      )
      .bind(commentId)
      .first<FeedbackCommentRow>();
    return row ? this.mapComment(row) : null;
  };

  getLatestCommentTimestampForUser = async (
    db: D1Database,
    userId: string
  ): Promise<string | null> => {
    await this.ensureSchema(db);
    const row = await db
      .prepare(
        `SELECT created_at
       FROM community_feedback_comments
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`
      )
      .bind(userId)
      .first<{ created_at: string }>();
    return row?.created_at ?? null;
  };

  softDeleteComment = async (db: D1Database, commentId: string): Promise<void> => {
    await this.ensureSchema(db);
    const now = new Date().toISOString();
    await db
      .prepare(
        `UPDATE community_feedback_comments
       SET deleted_at = ?, updated_at = ?
       WHERE id = ?`
      )
      .bind(now, now, commentId)
      .run();
  };
}

export const communityRepository = new CommunityRepository();
