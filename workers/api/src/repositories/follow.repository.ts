import { ensureNotificationSchema, notificationStatement } from '@gemigo/notifications/persistence';
type FollowRow = { follower_id: string; following_id: string; created_at: string };

let schemaEnsured = false;

export class FollowRepository {
  async ensureSchema(db: D1Database): Promise<void> {
    if (schemaEnsured) return;

    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS user_follows (
          follower_id TEXT NOT NULL,
          following_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY (follower_id, following_id)
        )`
      )
      .run();

    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_id)`
      )
      .run();

    await db
      .prepare(`CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_id)`)
      .run();

    await ensureNotificationSchema(db);
    try {
      await db.prepare('ALTER TABLE user_follows ADD COLUMN activation_id TEXT').run();
    } catch (error) {
      if (!String(error).includes('duplicate column')) throw error;
    }
    schemaEnsured = true;
  }

  countFollowers = async (db: D1Database, followingId: string): Promise<number> => {
    await this.ensureSchema(db);
    const row = await db
      .prepare(`SELECT COUNT(*) as count FROM user_follows WHERE following_id = ?`)
      .bind(followingId)
      .first<{ count: number }>();
    return row?.count ?? 0;
  };

  isFollowing = async (
    db: D1Database,
    followerId: string,
    followingId: string
  ): Promise<boolean> => {
    await this.ensureSchema(db);
    const row = await db
      .prepare(
        `SELECT 1 as ok FROM user_follows WHERE follower_id = ? AND following_id = ? LIMIT 1`
      )
      .bind(followerId, followingId)
      .first<{ ok: number }>();
    return !!row?.ok;
  };

  follow = async (
    db: D1Database,
    followerId: string,
    followingId: string,
    createdAt: string
  ): Promise<void> => {
    await this.ensureSchema(db);
    const activation = crypto.randomUUID();
    await db.batch([
      db
        .prepare(
          'INSERT OR IGNORE INTO user_follows(follower_id,following_id,created_at,activation_id) VALUES(?,?,?,?)'
        )
        .bind(followerId, followingId, createdAt, activation),
      notificationStatement(
        db,
        {
          key: 'follow:' + activation,
          actorId: followerId,
          recipientId: followingId,
          kind: 'follow',
          subjectId: followingId,
          groupKey: 'follow:' + followingId + ':' + createdAt.slice(0, 10),
          priority: 'light',
        },
        'EXISTS(SELECT 1 FROM user_follows WHERE follower_id=? AND following_id=? AND activation_id=?)',
        [followerId, followingId, activation]
      ),
    ]);
  };

  unfollow = async (db: D1Database, followerId: string, followingId: string): Promise<void> => {
    await this.ensureSchema(db);
    await db.batch([
      db
        .prepare(
          "UPDATE notifications SET revoked_at=? WHERE event_key IN(SELECT 'follow:'||activation_id FROM user_follows WHERE follower_id=? AND following_id=?)"
        )
        .bind(Date.now(), followerId, followingId),
      db
        .prepare('DELETE FROM user_follows WHERE follower_id=? AND following_id=?')
        .bind(followerId, followingId),
    ]);
  };

  getFollowRow = async (
    db: D1Database,
    followerId: string,
    followingId: string
  ): Promise<FollowRow | null> => {
    await this.ensureSchema(db);
    const row = await db
      .prepare(
        `SELECT follower_id, following_id, created_at FROM user_follows
         WHERE follower_id = ? AND following_id = ? LIMIT 1`
      )
      .bind(followerId, followingId)
      .first<FollowRow>();
    return row ?? null;
  };
}

export const followRepository = new FollowRepository();
