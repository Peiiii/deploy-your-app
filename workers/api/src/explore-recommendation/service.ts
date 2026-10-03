import type { ApiWorkerEnv } from '../types/env';
import type { ProjectQueryOptions } from '../repositories/project.repository';
import { projectRepository } from '../repositories/project.repository';
import { publicAuthorService } from '../services/public-author.service';
import { ValidationError, RateLimitError } from '../utils/error-handler';
import {
  settings,
  rateLimit,
  interests,
  features,
  saveBatch,
  getBatch,
  type Batch,
} from './repository';
import { resolveIdentity, sealSnapshot, openSnapshot } from './identity';
import { createCandidates, diversify, projectText, stableHash, type Interest } from './ranking';
import { budgetedModel, RANK_MODEL, rankModel, tokenUpperBound } from './model';

export interface FeedInput {
  action?: string;
  token?: string;
  persistent?: boolean;
  mode?: 'experiment' | 'recent' | 'recommended';
  session?: string;
  cursor?: string;
  filters?: { languages?: string[]; category?: string; tag?: string; search?: string };
  excludeIds?: string[];
  sessionInterests?: Interest[];
  events?: Array<{
    id: string;
    batch: string;
    projectId: string;
    action: string;
    durationMs?: number;
  }>;
}
function filtersOf(input: FeedInput): ProjectQueryOptions {
  const f = input.filters || {};
  if (typeof f !== 'object' || Array.isArray(f)) throw new ValidationError('Invalid filters');
  if (
    f.languages &&
    (!Array.isArray(f.languages) ||
      f.languages.length > 30 ||
      f.languages.some((l) => typeof l !== 'string' || !/^[a-z0-9-]{2,15}$/.test(l)))
  )
    throw new ValidationError('Invalid languages');
  for (const key of ['category', 'tag', 'search'] as const)
    if (f[key] !== undefined && (typeof f[key] !== 'string' || f[key].length > 100))
      throw new ValidationError('Invalid filter');
  return {
    languages: f.languages,
    category: f.category,
    tag: f.tag,
    search: f.search,
    onlyPublic: true,
  };
}
const actions = new Set([
  'exposure',
  'open',
  'loaded',
  'load_error',
  'like',
  'favorite',
  'dismiss',
  'dwell',
]);

export async function feedRequest(request: Request, env: ApiWorkerEnv, input: FeedInput) {
  const db = env.PROJECTS_DB;
  const config = await settings(db);
  if (input.action === 'status')
    return { enabled: !!config.enabled, experiment: config.experiment };
  const options = filtersOf(input);
  if (!config.enabled || !env.RECOMMENDATION_SECRET) return { enabled: false };
  const persistent = input.persistent !== false && request.headers.get('DNT') !== '1';
  const identityResult = await resolveIdentity(request, env, input.token, persistent);
  const { identity, token } = identityResult;
  const mode = ['recent', 'recommended'].includes(input.mode) ? input.mode : 'experiment';
  const assigned =
    stableHash(config.experiment + ':' + identity.subject) % 100 < config.percent
      ? 'treatment'
      : 'control';
  const variant = mode === 'experiment' ? assigned : `manual-${mode}`;
  const treatment = variant === 'treatment' || variant === 'manual-recommended';
  const base = { enabled: true, token, variant, experiment: config.experiment, persistent };
  if (input.action === 'reset') {
    if (persistent)
      await db.batch([
        db.prepare('DELETE FROM explore_rec_events WHERE subject=?').bind(identity.subject),
        db.prepare('DELETE FROM explore_rec_batches WHERE subject=?').bind(identity.subject),
      ]);
    return { ...base, cleared: true };
  }
  if (input.action === 'events') {
    if (!persistent) return { ...base, accepted: 0 };
    if (
      typeof input.session !== 'string' ||
      !/^[a-zA-Z0-9-]{1,64}$/.test(input.session) ||
      !Array.isArray(input.events) ||
      input.events.length > 20
    )
      throw new ValidationError('Invalid event batch');
    if (!(await rateLimit(db, identity.subject, 'event', 60))) throw new RateLimitError();
    const statements = [];
    const batches = new Map<string, Batch | null>();
    for (const event of input.events) {
      if (
        !event ||
        typeof event !== 'object' ||
        typeof event.id !== 'string' ||
        event.id.length > 80 ||
        typeof event.batch !== 'string' ||
        event.batch.length > 80 ||
        typeof event.projectId !== 'string' ||
        event.projectId.length > 100 ||
        !actions.has(event.action)
      )
        throw new ValidationError('Invalid event');
      if (!batches.has(event.batch))
        batches.set(event.batch, await getBatch(db, event.batch, identity.subject));
      const batch = batches.get(event.batch);
      if (!batch || !JSON.parse(batch.items).includes(event.projectId)) continue;
      const duration = Number.isFinite(event.durationMs)
        ? Math.min(600000, Math.max(0, Math.round(event.durationMs)))
        : 0;
      statements.push(
        db
          .prepare(
            `INSERT OR IGNORE INTO explore_rec_events(id,subject,session,batch_id,project_id,action,duration_ms,variant,experiment,algorithm,created_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?)`
          )
          .bind(
            event.id,
            identity.subject,
            input.session,
            event.batch,
            event.projectId,
            event.action,
            duration,
            batch.variant,
            batch.experiment,
            batch.algorithm,
            Date.now()
          )
      );
    }
    if (statements.length) await db.batch(statements);
    return { ...base, accepted: statements.length };
  }
  if (input.action && input.action !== 'feed') throw new ValidationError('Invalid action');
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify([options, mode, config.experiment]))
  );
  const filterKey = Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, '0')).join(
    ''
  );
  let batch: Batch | null = null;
  let offset = 0;
  if (input.cursor) {
    if (typeof input.cursor !== 'string' || input.cursor.length > 6500)
      throw new ValidationError('Invalid cursor');
    const separator = input.cursor.lastIndexOf(':');
    const id = input.cursor.slice(0, separator);
    offset = Number(input.cursor.slice(separator + 1));
    if (!Number.isInteger(offset) || offset < 0 || offset > 1500 || offset % 12 !== 0)
      throw new ValidationError('Invalid cursor');
    if (!persistent && id.startsWith('s.')) {
      try {
        batch = (await openSnapshot(id.slice(2), env.RECOMMENDATION_SECRET)) as Batch;
      } catch {
        throw new ValidationError('Invalid snapshot');
      }
      if (batch?.subject !== identity.subject || batch.expires_at < Date.now())
        throw new ValidationError('Expired snapshot');
    } else batch = await getBatch(db, id, identity.subject);
    if (!batch || batch.filters !== filterKey)
      throw new ValidationError('Expired or mismatched cursor');
  }
  if (!batch) {
    if (!(await rateLimit(db, identity.subject, 'batch', 20))) throw new RateLimitError();
    const catalog = await projectRepository.queryPublicFeedItems(db, options);
    const historical = persistent ? await interests(db, identity.subject) : [];
    const sessionInterests = Array.isArray(input.sessionInterests)
      ? input.sessionInterests
          .slice(0, 30)
          .filter(
            (i) =>
              i &&
              typeof i === 'object' &&
              typeof i.projectId === 'string' &&
              ['open', 'favorite', 'like', 'dismiss'].includes(i.action) &&
              Number.isFinite(i.at)
          )
          .map((i) => ({ ...i, at: Math.min(Date.now(), Math.max(Date.now() - 86400000, i.at)) }))
      : [];
    const behavior = [...sessionInterests, ...historical];
    // Unconsumed/aborted initial requests must not hide an entire 40-item batch.
    const exposed = persistent
      ? await db
          .prepare(
            `SELECT DISTINCT project_id AS id FROM explore_rec_events
      WHERE subject=? AND action='exposure' AND created_at>? LIMIT 1500`
          )
          .bind(identity.subject, Date.now() - 2 * 3600000)
          .all<{ id: string }>()
      : { results: [] };
    const seen = new Set(exposed.results.map((p) => p.id));
    const blocked = new Set(behavior.filter((i) => i.action === 'dismiss').map((i) => i.projectId));
    if (Array.isArray(input.excludeIds))
      for (const id of input.excludeIds.slice(0, 1500)) if (typeof id === 'string') seen.add(id);
    const available = catalog.filter((p) => !seen.has(p.id) && !blocked.has(p.id));
    let selected = available.slice(0, 40);
    let algorithm = 'recent';
    if (treatment) {
      const candidates = createCandidates(
        available,
        (await features(db)).filter((f) => f.model === config.embedding),
        behavior,
        identity.subject + config.experiment,
        catalog
      );
      selected = candidates.items;
      algorithm = 'content';
      if (
        candidates.query &&
        selected.length > 1 &&
        config.ranker === 'bge' &&
        env.RECOMMENDATION_AI &&
        (await rateLimit(db, identity.subject, 'rank', 2))
      ) {
        const contents = selected.map(projectText);
        const budget = contents.reduce(
          (sum, text) => sum + tokenUpperBound(candidates.query + '\n' + text),
          0
        );
        const result = await budgetedModel(
          db,
          config.monthly_micro,
          'rank',
          RANK_MODEL,
          budget,
          () => rankModel(env, candidates.query, contents),
          1200
        );
        if (result) {
          selected = result.order.map((index) => selected[index]);
          algorithm = 'bge';
        } else algorithm = 'content-fallback';
      }
      selected = diversify(selected);
    }
    const now = Date.now();
    batch = {
      id: crypto.randomUUID(),
      subject: identity.subject,
      filters: filterKey,
      variant,
      experiment: config.experiment,
      algorithm,
      items: JSON.stringify(selected.map((p) => p.id)),
      created_at: now,
      expires_at: now + 2 * 3600000,
    };
    // DNT identities use signed stateless snapshots instead of persistent batches/events.
    if (persistent) await saveBatch(db, batch);
  }
  const ids = JSON.parse(batch.items) as string[];
  const currentInterests = persistent
    ? await interests(db, identity.subject)
    : Array.isArray(input.sessionInterests)
      ? input.sessionInterests.filter((i) => i && typeof i === 'object')
      : [];
  const dismissed = new Set(
    currentInterests.filter((i) => i.action === 'dismiss').map((i) => i.projectId)
  );
  const slice = ids.slice(offset, offset + 12).filter((id) => !dismissed.has(id));
  // Recheck current visibility, URL, language and explicit filters after model await/cache.
  const current = await projectRepository.queryPublicFeedItems(db, options, slice);
  const currentById = new Map(current.map((p) => [p.id, p]));
  const items = await publicAuthorService.enrichProjects(
    db,
    slice.map((id) => currentById.get(id)).filter(Boolean)
  );
  const counts = items.length
    ? await db
        .prepare(
          `SELECT p.id,
    (SELECT COUNT(*) FROM project_likes WHERE project_id=p.id) AS likesCount,
    (SELECT COUNT(*) FROM project_favorites WHERE project_id=p.id) AS favoritesCount FROM projects p
    WHERE p.id IN (SELECT value FROM json_each(?))`
        )
        .bind(JSON.stringify(items.map((p) => p.id)))
        .all<{ id: string; likesCount: number; favoritesCount: number }>()
    : { results: [] };
  return {
    ...base,
    items,
    engagement: Object.fromEntries(
      (counts.results || []).map((r) => [
        r.id,
        { likesCount: r.likesCount, favoritesCount: r.favoritesCount },
      ])
    ),
    batch: batch.id,
    cursor:
      offset + 12 < ids.length
        ? `${persistent ? batch.id : 's.' + (await sealSnapshot(batch, env.RECOMMENDATION_SECRET))}:${offset + 12}`
        : null,
    hasMore: offset + 12 < ids.length || ids.length >= 40,
    algorithm: batch.algorithm,
  };
}
