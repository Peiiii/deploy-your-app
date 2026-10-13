import { writeFile, readFile } from 'node:fs/promises';
import { notificationSchema } from '../packages/notifications/src/persistence';
const path = 'workers/api/migrations/0009_engagement_notifications.sql';
const sql =
  '-- Generated from packages/notifications/src/persistence.ts by scripts/prepare-notification-migration.ts.\n' +
  notificationSchema.join(';\n') +
  ";\n\n-- Baseline existing public deployments before enabling the new producers; never fan out history.\nINSERT OR IGNORE INTO first_publications(project_id,published_at,author_id,baseline) SELECT id,CAST(strftime('%s','now') AS INTEGER)*1000,owner_id,1 FROM projects WHERE is_public=1 AND status='Live' AND url IS NOT NULL AND url<>'' AND (is_deleted=0 OR is_deleted IS NULL);\n";
if (process.argv.includes('--check')) {
  if ((await readFile(path, 'utf8')) !== sql)
    throw Error('Notification migration differs from canonical schema');
  console.log('Canonical notification migration matches.');
} else {
  await writeFile(path, sql);
  console.log('Prepared additive migration and historical publication baseline.');
}
