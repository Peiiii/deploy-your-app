import type { ApiWorkerEnv } from '../types/env';
import { AppError } from '../utils/error-handler';
import { PointsRepository } from './repository';
import type { PointsItem, PointsReceipt } from './types';

export async function refund(repo: PointsRepository, receipt: PointsReceipt, allowUnknown = false) {
  if (receipt.status === 'refunded' || receipt.status === 'released') return;
  const item = (await repo.item(receipt.item_id))!;
  const id = receipt.id;
  if (!allowUnknown && (receipt.status !== 'granted' || item.delivery === 'ai'))
    throw new AppError('此服务需要平台核查后退款。', 409, 'REFUND_REVIEW_REQUIRED');
  const queries = [
    repo.statement(
      "INSERT INTO points_assertions(id,ok) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM points_receipts WHERE id=? AND status IN('granted','unknown','reserved')) THEN 1 ELSE 0 END",
      id,
      id
    ),
  ];
  if (item.delivery === 'grant') {
    if (item.type === 'repeatable') {
      queries.push(
        repo.statement(
          'INSERT INTO points_assertions(id,ok) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM points_grants WHERE receipt_id=? AND remaining=total) THEN 1 ELSE 0 END',
          `grant:${id}`,
          id
        )
      );
      queries.push(repo.statement('DELETE FROM points_grants WHERE receipt_id=?', id));
    } else if (item.type === 'durable')
      queries.push(repo.statement('DELETE FROM points_durable WHERE receipt_id=?', id));
    else {
      queries.push(
        repo.statement(
          'INSERT INTO points_assertions(id,ok) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM points_terms WHERE receipt_id=?) THEN 1 ELSE 0 END',
          `grant:${id}`,
          id
        )
      );
      if (receipt.previous_receipt)
        queries.push(
          repo.statement(
            'UPDATE points_terms SET expires_at=?,receipt_id=? WHERE receipt_id=?',
            receipt.previous_expiry || 0,
            receipt.previous_receipt,
            id
          )
        );
      else queries.push(repo.statement('DELETE FROM points_terms WHERE receipt_id=?', id));
    }
  }
  if (item.type === 'term')
    queries.push(
      repo.statement(
        'UPDATE points_subscriptions SET active=0 WHERE user_id=? AND project_id=? AND item_id=?',
        receipt.user_id,
        receipt.project_id,
        item.id
      )
    );
  queries.push(
    repo.statement(
      'UPDATE points_allocations SET returned=1 WHERE receipt_id=? AND returned=0',
      id
    ),
    repo.statement(
      'UPDATE points_receipts SET status=?,creator_minor=0,updated_at=? WHERE id=?',
      allowUnknown ? 'released' : 'refunded',
      Date.now(),
      id
    ),
    repo.statement('DELETE FROM points_assertions WHERE id IN(?,?)', id, `grant:${id}`)
  );
  try {
    await repo.db.batch(queries);
  } catch {
    const current = await repo
      .statement('SELECT status FROM points_receipts WHERE id=?', id)
      .first<{ status: string }>();
    if (!['refunded', 'released'].includes(current?.status || ''))
      throw new AppError('权益已使用或已发生后续购买，请平台核查。', 409, 'REFUND_REVIEW_REQUIRED');
  }
}
export async function runAi(env: ApiWorkerEnv, repo: PointsRepository, receipt: PointsReceipt) {
  if (!env.RECOMMENDATION_AI) return;
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  const lock = await repo
    .statement(
      "UPDATE points_receipts SET status='running',updated_at=? WHERE id=? AND status='reserved' RETURNING *",
      now,
      receipt.id
    )
    .first<PointsReceipt>();
  if (!lock) return;
  try {
    const [budget] = await repo.db.batch([
      repo.statement(
        'INSERT INTO points_ai_budget(day,used) VALUES(?,1) ON CONFLICT(day) DO UPDATE SET used=used+1 RETURNING used',
        day
      ),
      repo.statement(
        'INSERT INTO points_assertions(id,ok) SELECT ?,CASE WHEN (SELECT used FROM points_ai_budget WHERE day=?)<=(SELECT ai_daily_limit FROM points_settings WHERE id=1) THEN 1 ELSE 0 END',
        `ai:${receipt.id}`,
        day
      ),
      repo.statement('DELETE FROM points_assertions WHERE id=?', `ai:${receipt.id}`),
    ]);
    if (!budget.success) throw new Error('budget');
  } catch {
    await repo
      .statement(
        "UPDATE points_receipts SET status='unknown',error='AI 体验预算已用完',updated_at=? WHERE id=?",
        Date.now(),
        receipt.id
      )
      .run();
    await refund(repo, { ...receipt, status: 'unknown' }, true);
    return;
  }
  try {
    const row = await repo
      .statement('SELECT payload FROM points_receipts WHERE id=?', receipt.id)
      .first<{ payload: string }>();
    const input = JSON.parse(row?.payload || '{}') as { topic: string };
    // Fixed service: no client-selected model, URL, secret or unbounded prompt.
    const result = (await env.RECOMMENDATION_AI.run('@cf/meta/llama-3.1-8b-instruct-fp8', {
      messages: [
        {
          role: 'system',
          content:
            '你是一名知识讲解员，用中文在200字以内解释一个科学或历史概念。不提供医疗、法律或投资建议。',
        },
        { role: 'user', content: input.topic },
      ],
      max_tokens: 256,
    })) as { response?: string };
    if (!result?.response) {
      await repo
        .statement(
          "UPDATE points_receipts SET status='unknown',error='未收到可交付结果',updated_at=? WHERE id=?",
          Date.now(),
          receipt.id
        )
        .run();
      await refund(repo, { ...receipt, status: 'unknown' }, true);
      return;
    }
    await repo
      .statement(
        "UPDATE points_receipts SET status='granted',result=?,updated_at=? WHERE id=? AND status='running'",
        JSON.stringify({ text: result.response }),
        Date.now(),
        receipt.id
      )
      .run();
  } catch {
    // Failure may have occurred after upstream execution. Never blindly run it again.
    await repo
      .statement(
        "UPDATE points_receipts SET status='unknown',error='服务结果待核查，请勿重复购买',updated_at=? WHERE id=? AND status='running'",
        Date.now(),
        receipt.id
      )
      .run();
  }
}
export async function processPointsScheduled(env: ApiWorkerEnv) {
  const repo = new PointsRepository(env.PROJECTS_DB);
  const now = Date.now();
  // A dead Worker does not authorize replaying a potentially completed upstream call.
  await repo
    .statement(
      "UPDATE points_receipts SET status='unknown',error='执行中断，结果待核查',updated_at=? WHERE status='running' AND updated_at<?",
      now,
      now - 300000
    )
    .run();
  const reserved = (
    await repo
      .statement(
        "SELECT * FROM points_receipts WHERE status='reserved' ORDER BY created_at LIMIT 2"
      )
      .all<PointsReceipt>()
  ).results;
  for (const receipt of reserved) await runAi(env, repo, receipt);
  const due = (
    await repo
      .statement(
        'SELECT * FROM points_subscriptions WHERE active=1 AND due_at<=? ORDER BY due_at LIMIT 20',
        now
      )
      .all<{ id: string; user_id: string; item_id: string; due_at: number }>()
  ).results;
  for (const sub of due) {
    const item = await repo.item(sub.item_id);
    const project = item
      ? await repo
          .statement(
            "SELECT id FROM projects WHERE id=? AND status='Live' AND COALESCE(is_deleted,0)=0 AND owner_id=?",
            item.project_id,
            item.author_id
          )
          .first()
      : null;
    if (!item?.enabled || !project) {
      await repo.statement('UPDATE points_subscriptions SET active=0 WHERE id=?', sub.id).run();
      continue;
    }
    try {
      const receipt = await repo.purchase(
        sub.user_id,
        item,
        `renew:${sub.id}:${sub.due_at}`,
        null,
        sub.id
      );
      if (receipt.status === 'granted')
        await repo
          .statement(
            'UPDATE points_subscriptions SET due_at=? WHERE id=? AND due_at=?',
            Math.max(now, sub.due_at) + item.period_seconds * 1000,
            sub.id,
            sub.due_at
          )
          .run();
    } catch {
      await repo
        .statement(
          'UPDATE points_subscriptions SET active=0 WHERE id=? AND due_at=?',
          sub.id,
          sub.due_at
        )
        .run();
    }
  }
}
export function validateItem(data: Record<string, unknown>) {
  const type = data.type;
  const delivery = data.delivery ?? 'grant';
  if (
    !['repeatable', 'durable', 'term'].includes(String(type)) ||
    !['grant', 'ai'].includes(String(delivery)) ||
    (delivery === 'ai' && type !== 'repeatable')
  )
    throw new AppError('收费项类型不正确。', 400, 'INVALID_INPUT');
  return { type: type as PointsItem['type'], delivery: delivery as PointsItem['delivery'] };
}
