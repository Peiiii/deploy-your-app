import type { ApiWorkerEnv } from '../types/env';

export const EMBEDDING_MODEL = '@cf/baai/bge-m3';
export const RANK_MODEL = '@cf/baai/bge-reranker-base';

interface Usage {
  prompt_tokens?: number;
  input_tokens?: number;
  neurons?: number;
}
interface RankResponse {
  response?: Array<{ id: number; score: number }>;
  usage?: Usage;
}
interface EmbeddingResponse {
  data?: number[][];
  usage?: Usage;
}

/** The only model boundary; the UI/profile never reads vendor scores or payloads. */
export async function rankModel(env: ApiWorkerEnv, query: string, contents: string[]) {
  const result = (await env.RECOMMENDATION_AI.run(RANK_MODEL, {
    query,
    contexts: contents.map((text) => ({ text })),
  })) as RankResponse;
  const rows = result.response;
  if (
    !Array.isArray(rows) ||
    rows.length !== contents.length ||
    new Set(rows.map((r) => r.id)).size !== contents.length ||
    rows.some(
      (r) =>
        !Number.isInteger(r.id) || r.id < 0 || r.id >= contents.length || !Number.isFinite(r.score)
    )
  ) {
    throw new Error('invalid_model_output');
  }
  return {
    order: [...rows].sort((a, b) => b.score - a.score).map((r) => r.id),
    tokens: result.usage?.prompt_tokens ?? result.usage?.input_tokens,
  };
}

export async function embedModel(env: ApiWorkerEnv, contents: string[]) {
  const result = (await env.RECOMMENDATION_AI.run(EMBEDDING_MODEL, {
    text: contents,
  })) as EmbeddingResponse;
  if (
    !Array.isArray(result.data) ||
    result.data.length !== contents.length ||
    result.data.some(
      (vector) =>
        !Array.isArray(vector) || vector.length !== 1024 || vector.some((n) => !Number.isFinite(n))
    )
  ) {
    throw new Error('invalid_embedding_output');
  }
  return {
    vectors: result.data.map(packVector),
    tokens: result.usage?.prompt_tokens ?? result.usage?.input_tokens,
  };
}

/** Quantized public features avoid multi-megabyte D1 responses and vector infrastructure. */
export function packVector(vector: number[]): string {
  const scale = Math.max(...vector.map(Math.abs)) || 1;
  return btoa(String.fromCharCode(...vector.map((n) => Math.round((n / scale) * 127) + 128)));
}
export function unpackVector(value: string): number[] {
  const vector = Array.from(atob(value), (ch) => ch.charCodeAt(0) - 128);
  const norm = Math.sqrt(vector.reduce((sum, n) => sum + n * n, 0)) || 1;
  return vector.map((n) => n / norm);
}
export function cosine(a: number[], b: number[]): number {
  return a.length === b.length ? a.reduce((sum, n, i) => sum + n * b[i], 0) : 0;
}

export function tokenUpperBound(text: string): number {
  // Tokenization cannot exceed UTF-8 bytes; margin includes tokenizer special tokens.
  return new TextEncoder().encode(text).length + 256;
}

export async function budgetedModel<T>(
  db: D1Database,
  limit: number,
  kind: 'index' | 'rank',
  model: string,
  tokens: number,
  operation: () => Promise<{ tokens?: number } & T>,
  timeoutMs: number
): Promise<({ tokens?: number } & T) | null> {
  const month = new Date().toISOString().slice(0, 7);
  const price = kind === 'index' ? 0.0118 : 0.00311;
  const reserve = Math.max(1, Math.ceil(tokens * price)); // dollar/M tokens -> microdollars/token
  await db.prepare('INSERT OR IGNORE INTO explore_rec_budget(month) VALUES(?)').bind(month).run();
  const id = crypto.randomUUID();
  const started = Date.now();
  const [reserved] = await db.batch([
    db
      .prepare(
        `UPDATE explore_rec_budget SET reserved_micro=reserved_micro+?
      WHERE month=? AND reserved_micro+?<=?`
      )
      .bind(reserve, month, reserve, limit),
    db
      .prepare(
        `INSERT INTO explore_rec_calls(id,month,kind,model,reserved_micro,status,created_at)
      SELECT ?,?,?,?,?, 'pending',? WHERE changes()>0`
      )
      .bind(id, month, kind, model, reserve, started),
  ]);
  if (!reserved.meta.changes) return null;
  let timer: ReturnType<typeof setTimeout>;
  try {
    const result = await Promise.race([
      operation(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('model_timeout')), timeoutMs);
      }),
    ]);
    const actual =
      result.tokens === undefined ? reserve : Math.max(1, Math.ceil(result.tokens * price));
    if (actual > reserve) {
      // A violated conservative estimate fails closed; preserve actual liability.
      await db.batch([
        db
          .prepare('UPDATE explore_rec_budget SET reserved_micro=reserved_micro+? WHERE month=?')
          .bind(actual - reserve, month),
        db.prepare('UPDATE explore_rec_settings SET enabled=0 WHERE id=1'),
      ]);
    } else if (actual < reserve) {
      await db
        .prepare('UPDATE explore_rec_budget SET reserved_micro=reserved_micro-? WHERE month=?')
        .bind(reserve - actual, month)
        .run();
    }
    await db
      .prepare(
        `UPDATE explore_rec_calls SET status='success',actual_micro=?,input_tokens=?,latency_ms=? WHERE id=?`
      )
      .bind(
        result.tokens === undefined ? null : actual,
        result.tokens ?? null,
        Date.now() - started,
        id
      )
      .run();
    return result;
  } catch (error) {
    const status =
      error instanceof Error && error.message === 'model_timeout' ? 'timeout' : 'error';
    await db
      .prepare('UPDATE explore_rec_calls SET status=?,latency_ms=? WHERE id=?')
      .bind(status, Date.now() - started, id)
      .run();
    return null; // unknown charge is deliberately kept reserved
  } finally {
    clearTimeout(timer!);
  }
}
