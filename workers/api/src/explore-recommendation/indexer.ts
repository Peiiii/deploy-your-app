import type { ApiWorkerEnv } from '../types/env';
import { projectRepository } from '../repositories/project.repository';
import { buildInlineHtmlContext } from '../services/metadata.service';
import { projectText, revision } from './ranking';
import { EMBEDDING_MODEL, embedModel, tokenUpperBound, budgetedModel } from './model';
import { settings, features, invalidateFeatures, cleanup } from './repository';

export async function indexPending(env: ApiWorkerEnv, requested = 16) {
  const db = env.PROJECTS_DB;
  const config = await settings(db);
  if (!config.enabled || !env.RECOMMENDATION_AI || config.embedding !== EMBEDDING_MODEL)
    return { indexed: 0, reason: 'disabled' };
  const catalog = await projectRepository.queryPublicFeedItems(db, {});
  const old = new Map((await features(db)).map((f) => [f.project_id, f]));
  const pending = catalog
    .filter((p) => {
      const f = old.get(p.id);
      return (
        (!f || f.model !== EMBEDDING_MODEL || f.revision !== revision(p) || !f.vector) &&
        (!f || f.retry_at < Date.now())
      );
    })
    .slice(0, Math.min(32, Math.max(1, requested)));
  const selected = [];
  for (const project of pending) {
    const claimed = await db
      .prepare(
        `INSERT INTO explore_rec_features(project_id,revision,model,content,vector,retry_at,updated_at)
      VALUES(?,?,?,? ,NULL,?,?) ON CONFLICT(project_id) DO UPDATE SET retry_at=excluded.retry_at
      WHERE explore_rec_features.retry_at<? AND (explore_rec_features.vector IS NULL OR
        explore_rec_features.model<>excluded.model OR explore_rec_features.revision<>excluded.revision) RETURNING project_id`
      )
      .bind(
        project.id,
        revision(project),
        EMBEDDING_MODEL,
        projectText(project),
        Date.now() + 120000,
        Date.now(),
        Date.now()
      )
      .first();
    if (claimed) selected.push(project);
  }
  if (!selected.length) return { indexed: 0, pending: pending.length };
  const texts = [];
  const safeSelected = [];
  for (const project of selected) {
    const source = await projectRepository.getProjectById(db, project.id);
    if (
      !source ||
      source.isPublic === false ||
      source.isDeleted ||
      source.status !== 'Live' ||
      revision(source) !== revision(project)
    )
      continue;
    safeSelected.push(project);
    const visible = buildInlineHtmlContext(source.htmlContent);
    texts.push((projectText(project) + (visible ? '\n' + visible : '')).slice(0, 1200));
  }
  if (!texts.length) return { indexed: 0, reason: 'changed_catalog' };
  const result = await budgetedModel(
    db,
    config.monthly_micro,
    'index',
    EMBEDDING_MODEL,
    texts.reduce((n, text) => n + tokenUpperBound(text), 0),
    () => embedModel(env, texts),
    15000
  );
  if (!result) return { indexed: 0, reason: 'model_or_budget', pending: pending.length };
  await db.batch(
    safeSelected.map((p, i) =>
      db
        .prepare(
          `UPDATE explore_rec_features SET revision=?,model=?,content=?,vector=?,retry_at=0,updated_at=? WHERE project_id=?`
        )
        .bind(revision(p), EMBEDDING_MODEL, texts[i], result.vectors[i], Date.now(), p.id)
    )
  );
  invalidateFeatures();
  return {
    indexed: safeSelected.length,
    pending: Math.max(0, catalog.length - old.size),
    model: EMBEDDING_MODEL,
  };
}
export async function scheduledRecommendation(env: ApiWorkerEnv) {
  if (!env.RECOMMENDATION_SECRET) return;
  await cleanup(env.PROJECTS_DB);
  await indexPending(env);
}
