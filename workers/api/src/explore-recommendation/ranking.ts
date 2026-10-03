import type { Project } from '../types/project';
import { cosine, unpackVector } from './model';

export interface Feature {
  project_id: string;
  revision: string;
  model: string;
  content: string;
  vector: string | null;
  retry_at: number;
}
export interface Interest {
  projectId: string;
  action: string;
  at: number;
}

export function projectText(p: Project): string {
  return [p.name, p.description, p.category, ...(p.tags || [])]
    .filter(Boolean)
    .join('\n')
    .slice(0, 600);
}
export function revision(p: Project): string {
  // The complete bounded metadata is the revision; no independent mutable hash owner.
  return JSON.stringify([
    p.lastSuccessAt || p.lastDeployed,
    projectText(p),
    p.appLanguage?.languages,
  ]);
}
export function quality(p: Project): number {
  const text = projectText(p);
  return (
    Math.min(1, (p.description?.length || 0) / 80) +
    (p.tags?.length ? 0.2 : 0) -
    (/placeholder|starter|prototype|likely|basic html|hello gemigo|template|draft|占位|测试|可能用于/i.test(
      text
    )
      ? 1.2
      : 0) -
    (/^(app-|test$|\d+$)/i.test(p.name) ? 0.3 : 0)
  );
}
function affinity(query: string, text: string): number {
  const tokens = query.toLowerCase().match(/[a-z]{3,}|[\u4e00-\u9fff]{2}/g) || [];
  return tokens.length
    ? tokens.filter((t) => text.toLowerCase().includes(t)).length / tokens.length
    : 0;
}
export function createCandidates(
  projects: Project[],
  features: Feature[],
  interests: Interest[],
  seed: string,
  profileCatalog: Project[] = projects
) {
  const byId = new Map(profileCatalog.map((p) => [p.id, p]));
  const featureById = new Map(features.map((f) => [f.project_id, f]));
  const blocked = new Set(interests.filter((i) => i.action === 'dismiss').map((i) => i.projectId));
  const recent = interests
    .filter((i) => ['open', 'favorite', 'like'].includes(i.action))
    .slice(0, 12);
  const vector = Array<number>(1024).fill(0);
  let totalWeight = 0;
  for (const i of recent) {
    const f = featureById.get(i.projectId);
    const p = byId.get(i.projectId);
    if (!p || !f?.vector || f.revision !== revision(p)) continue;
    const weight =
      (i.action === 'favorite' ? 3 : i.action === 'like' ? 2 : 1) *
      Math.exp(-(Date.now() - i.at) / (7 * 86400000));
    unpackVector(f.vector).forEach((n, k) => (vector[k] += n * weight));
    totalWeight += weight;
  }
  const norm = Math.sqrt(vector.reduce((sum, n) => sum + n * n, 0)) || 1;
  const normalized = vector.map((n) => n / norm);
  const query = recent
    .map((i) => byId.get(i.projectId))
    .filter(Boolean)
    .slice(0, 3)
    .map((p) => projectText(p!))
    .join('\n')
    .slice(0, 256);
  const scored = projects
    .filter((p) => !blocked.has(p.id))
    .map((p, index) => {
      const f = featureById.get(p.id);
      const similarity =
        totalWeight && f?.vector && f.revision === revision(p)
          ? cosine(normalized, unpackVector(f.vector))
          : affinity(query, projectText(p));
      return { project: p, score: similarity * 5 + quality(p) * 0.5 + 0.1 / (1 + index), index };
    });
  scored.sort((a, b) => b.score - a.score || a.project.id.localeCompare(b.project.id));
  const selected = scored.slice(0, 30);
  // Always include recent works and deterministic exploration candidates, without duplicates.
  for (const p of projects.filter((p) => !blocked.has(p.id)).slice(0, 6)) {
    const item = scored.find((x) => x.project.id === p.id);
    if (item && !selected.includes(item)) selected.push(item);
  }
  const random = [...scored].sort(
    (a, b) => stableHash(seed + a.project.id) - stableHash(seed + b.project.id)
  );
  for (const item of random) {
    if (!selected.includes(item)) selected.push(item);
    if (selected.length >= 40) break;
  }
  return { items: selected.slice(0, 40).map((x) => x.project), query };
}
export function stableHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return hash >>> 0;
}
export function diversify(projects: Project[]): Project[] {
  const pending = [...projects];
  const output: Project[] = [];
  while (pending.length) {
    const previous = output.at(-1);
    const index = pending.findIndex(
      (p) =>
        !previous ||
        ((!p.ownerId || !previous.ownerId || p.ownerId !== previous.ownerId) &&
          (output.length % 4 !== 3 || p.category !== previous.category))
    );
    output.push(pending.splice(index >= 0 ? index : 0, 1)[0]);
  }
  return output;
}
