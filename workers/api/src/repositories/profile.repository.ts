export interface ProfileLinkRecord {
  label: string | null;
  url: string;
}

export interface UserProfileRecord {
  userId: string;
  bio: string | null;
  links: ProfileLinkRecord[];
  pinnedProjectIds: string[];
}

type UserProfileRow = {
  user_id: string;
  bio: string | null;
  website: string | null;
  github: string | null;
  twitter: string | null;
  pinned_project_ids: string | null;
  links: string | null;
};

let profileSchemaEnsured = false;

class ProfileRepository {
  private async ensureSchema(db: D1Database): Promise<void> {
    if (profileSchemaEnsured) return;

    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS user_profiles (
          user_id TEXT PRIMARY KEY,
          bio TEXT,
          website TEXT,
          github TEXT,
          twitter TEXT,
          pinned_project_ids TEXT,
          links TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY(user_id) REFERENCES users(id)
        )`,
      )
      .run();

    // Best-effort migration for databases created before the links column existed.
    try {
      await db
        .prepare(`ALTER TABLE user_profiles ADD COLUMN links TEXT`)
        .run();
    } catch {
      // ignore if column already exists
    }

    profileSchemaEnsured = true;
  }

  private mapRowToRecord(row: UserProfileRow): UserProfileRecord {
    let links: ProfileLinkRecord[] = [];

    if (typeof row.links === 'string' && row.links.trim().length > 0) {
      try {
        const parsed = JSON.parse(row.links);
        if (Array.isArray(parsed)) {
          links = parsed
            .filter(
              (item): item is { label?: unknown; url?: unknown } =>
                !!item && typeof item === 'object',
            )
            .map((item) => {
              const label =
                typeof item.label === 'string' ? item.label : null;
              const url =
                typeof item.url === 'string' ? item.url : '';
              return { label, url };
            })
            .filter((link) => link.url.trim().length > 0);
        }
      } catch {
        links = [];
      }
    }

    let pinned: string[] = [];
    if (typeof row.pinned_project_ids === 'string') {
      try {
        const parsed = JSON.parse(row.pinned_project_ids);
        if (Array.isArray(parsed)) {
          pinned = parsed
            .filter((id): id is string => typeof id === 'string')
            .map((id) => id);
        }
      } catch {
        pinned = [];
      }
    }

    // Fallback for legacy rows that only had website/github/twitter populated.
    if (links.length === 0) {
      if (row.website && row.website.trim().length > 0) {
        links.push({
          label: 'Website',
          url: row.website,
        });
      }
      if (row.github && row.github.trim().length > 0) {
        links.push({
          label: 'GitHub',
          url: row.github,
        });
      }
      if (row.twitter && row.twitter.trim().length > 0) {
        links.push({
          label: 'Twitter',
          url: row.twitter,
        });
      }
    }

    return {
      userId: row.user_id,
      bio: row.bio,
      links,
      pinnedProjectIds: pinned,
    };
  }

  async getProfile(
    db: D1Database,
    userId: string,
  ): Promise<UserProfileRecord | null> {
    await this.ensureSchema(db);
    const row = await db
      .prepare(
        `SELECT user_id, bio, website, github, twitter, pinned_project_ids, links
         FROM user_profiles
         WHERE user_id = ?`,
      )
      .bind(userId)
      .first<UserProfileRow>();

    return row ? this.mapRowToRecord(row) : null;
  }

  async upsertProfile(
    db: D1Database,
    userId: string,
    patch: {
      bio?: string | null;
      links?: ProfileLinkRecord[];
      pinnedProjectIds?: string[];
    },
  ): Promise<UserProfileRecord> {
    await this.ensureSchema(db);

    const existing = await this.getProfile(db, userId);
    const now = new Date().toISOString();

    const next: UserProfileRecord = {
      userId,
      bio:
        patch.bio !== undefined
          ? patch.bio
          : existing?.bio ?? null,
      links:
        patch.links !== undefined
          ? patch.links
          : existing?.links ?? [],
      pinnedProjectIds:
        patch.pinnedProjectIds !== undefined
          ? patch.pinnedProjectIds
          : existing?.pinnedProjectIds ?? [],
    };

    const pinnedJson =
      next.pinnedProjectIds && next.pinnedProjectIds.length > 0
        ? JSON.stringify(next.pinnedProjectIds)
        : null;

    const linksJson =
      next.links && next.links.length > 0
        ? JSON.stringify(next.links)
        : null;

    if (!existing) {
      await db
        .prepare(
          `INSERT INTO user_profiles (
            user_id, bio, website, github, twitter, pinned_project_ids, links,
            created_at, updated_at
          ) VALUES (?, ?, NULL, NULL, NULL, ?, ?, ?)`,
        )
        .bind(
          next.userId,
          next.bio,
          pinnedJson,
          linksJson,
          now,
          now,
        )
        .run();
    } else {
      await db
        .prepare(
          `UPDATE user_profiles
           SET bio = ?, pinned_project_ids = ?, links = ?, updated_at = ?
           WHERE user_id = ?`,
        )
        .bind(
          next.bio,
          pinnedJson,
          linksJson,
          now,
          next.userId,
        )
        .run();
    }

    return next;
  }
}

export const profileRepository = new ProfileRepository();
