import { execFileSync } from 'node:child_process';
import { aiService } from '../workers/api/src/services/ai.service';
import {
  DESCRIPTION_TRANSLATION_CANDIDATES_SQL,
  descriptionTranslationWrite,
} from '../workers/api/src/repositories/project.repository';
import type { ApiWorkerEnv } from '../workers/api/src/types/env';

const apply = process.argv.includes('--apply');
const limit = Number(process.argv.find((a) => a.startsWith('--limit='))?.slice(8) || 1000);
if (!Number.isInteger(limit) || limit < 1 || limit > 2000) throw new Error('limit must be 1–2000');
const envFile = process.argv.find((a) => a.startsWith('--env-file='))?.slice(11);
if (apply && envFile) process.loadEnvFile(envFile);
const env = process.env as unknown as ApiWorkerEnv;
if (apply && !aiService.isEnabled(env)) throw new Error('AI credentials required for apply');
const sqlLiteral = (value: unknown): string =>
  typeof value === 'number' ? String(value) : `'${String(value).replaceAll("'", "''")}'`;
const bind = (sql: string, params: unknown[]): string => {
  let i = 0;
  return sql.replace(/\?/g, () => sqlLiteral(params[i++]));
};
function execute(sql: string) {
  const output = execFileSync(
    'pnpm',
    [
      '--filter',
      'deploy-your-app-api-worker',
      'exec',
      'wrangler',
      'd1',
      'execute',
      'gemigo-projects',
      '--remote',
      '--json',
      '--command',
      sql,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  return JSON.parse(output.slice(output.indexOf('['), output.lastIndexOf(']') + 1));
}
{
  const rows =
    execute(bind(DESCRIPTION_TRANSLATION_CANDIDATES_SQL, [new Date().toISOString(), limit]))[0]
      ?.results || [];
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', candidates: rows.length }));
  if (apply) {
    let index = 0,
      completed = 0,
      failed = 0,
      changed = 0;
    const writes: string[] = [];
    await Promise.all(
      Array.from({ length: 5 }, async () => {
        while (index < rows.length && !(failed >= 6 && completed === 0)) {
          const row = rows[index++];
          const locales = await aiService.translateDescription(env, row.description);
          if (!locales) {
            failed++;
            continue;
          }
          const write = descriptionTranslationWrite(
            { id: row.id, description: row.description },
            { source: row.description, locales }
          );
          writes.push(bind(write.sql, write.params) + ';');
          completed++;
          if ((completed + failed) % 50 === 0) console.log(JSON.stringify({ completed, failed }));
        }
      })
    );
    for (let offset = 0; offset < writes.length; offset += 20) {
      for (const result of execute(writes.slice(offset, offset + 20).join('\n')))
        changed += result.meta?.changes || 0;
    }
    console.log(JSON.stringify({ completed, failed, changed }));
    if (failed) process.exitCode = 1;
  }
}
