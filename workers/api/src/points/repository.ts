import type { PointsItem, PointsLot, PointsReceipt } from './types';
import { AppError } from '../utils/error-handler';

export class PointsRepository {
  constructor(readonly db: D1Database) {}
  statement(sql: string, ...values: unknown[]) {
    return this.db.prepare(sql).bind(...values);
  }
  async balance(user: string) {
    return this.statement(
      "SELECT COALESCE(SUM(remaining),0) balance, COALESCE(SUM(CASE WHEN kind='trial' THEN remaining ELSE 0 END),0) trial FROM points_lots WHERE user_id=?",
      user
    ).first<{ balance: number; trial: number }>();
  }
  receipt(user: string, project: string, request: string) {
    return this.statement(
      'SELECT * FROM points_receipts WHERE user_id=? AND project_id=? AND request_id=?',
      user,
      project,
      request
    ).first<PointsReceipt>();
  }
  item(id: string) {
    return this.statement('SELECT * FROM points_items WHERE id=?', id).first<PointsItem>();
  }
  async claim(user: string) {
    const ref = `trial:${user}`;
    const id = crypto.randomUUID();
    const now = Date.now();
    if (await this.statement('SELECT id FROM points_lots WHERE source_ref=?', ref).first())
      return { alreadyClaimed: true };
    try {
      await this.db.batch([
        this.statement(
          'UPDATE points_settings SET trial_issued=trial_issued+trial_points WHERE id=1'
        ),
        this.statement(
          "INSERT INTO points_lots(id,user_id,source_ref,kind,total,remaining,created_at) SELECT ?,?,?,'trial',trial_points,trial_points,? FROM points_settings WHERE id=1",
          id,
          user,
          ref,
          now
        ),
      ]);
    } catch {
      if (await this.statement('SELECT id FROM points_lots WHERE source_ref=?', ref).first())
        return { alreadyClaimed: true };
      throw new AppError('体验点预算已用完，请稍后再来。', 409, 'TRIAL_UNAVAILABLE');
    }
    return { alreadyClaimed: false };
  }
  async purchase(
    user: string,
    item: PointsItem,
    requestId: string,
    payload: string | null,
    subscriptionId?: string
  ) {
    const existing = await this.receipt(user, item.project_id, requestId);
    if (existing) {
      if (existing.item_id !== item.id)
        throw new AppError('请求 ID 已用于另一消费。', 409, 'REQUEST_MISMATCH');
      return existing;
    }
    if (item.type === 'durable') {
      const owned = await this.statement(
        'SELECT r.* FROM points_durable g JOIN points_receipts r ON r.id=g.receipt_id WHERE g.user_id=? AND g.project_id=? AND g.entitlement=?',
        user,
        item.project_id,
        item.entitlement
      ).first<PointsReceipt>();
      if (owned) return owned;
    }
    const lots = (
      await this.statement(
        'SELECT * FROM points_lots WHERE user_id=? AND remaining>0 ORDER BY created_at,id LIMIT 100',
        user
      ).all<PointsLot>()
    ).results;
    let needed = item.price;
    const allocations: { lot: PointsLot; take: number; value: number; fee: number }[] = [];
    for (const lot of lots) {
      const take = Math.min(needed, lot.remaining);
      if (!take) break;
      const spent = lot.total - lot.remaining;
      const value =
        Math.floor(((spent + take) * lot.paid_minor) / lot.total) -
        Math.floor((spent * lot.paid_minor) / lot.total);
      const fee =
        Math.floor(((spent + take) * lot.fee_minor) / lot.total) -
        Math.floor((spent * lot.fee_minor) / lot.total);
      allocations.push({ lot, take, value, fee });
      needed -= take;
    }
    if (needed)
      throw new AppError('点数不足，请前往钱包领取体验点或充值。', 402, 'INSUFFICIENT_POINTS');
    const currencies = new Set(allocations.filter((a) => a.value).map((a) => a.lot.currency));
    if (currencies.size > 1) throw new AppError('不支持混合结算币种。', 409, 'CURRENCY_MISMATCH');
    const settings = await this.statement(
      'SELECT creator_bps,live_payments FROM points_settings WHERE id=1'
    ).first<{ creator_bps: number | null; live_payments: number }>();
    const paid = allocations.reduce((s, a) => s + a.value, 0),
      fee = allocations.reduce((s, a) => s + a.fee, 0);
    if (paid && (!settings?.live_payments || settings.creator_bps === null))
      throw new AppError('真实收费尚未启用。', 503, 'PAYMENTS_UNAVAILABLE');
    if (paid && item.delivery === 'ai')
      throw new AppError('AI 成本与真钱结算规则尚未开通。', 503, 'PAYMENTS_UNAVAILABLE');
    const bps = user === item.author_id ? 0 : (settings?.creator_bps ?? 0);
    const id = crypto.randomUUID(),
      now = Date.now(),
      status = item.delivery === 'ai' ? 'reserved' : 'granted';
    const queries = [
      this.statement(
        "INSERT INTO points_receipts(id,user_id,project_id,author_id,item_id,request_id,status,price,paid_minor,fee_minor,creator_minor,currency,creator_bps,subscription_id,payload,created_at,updated_at) VALUES(?,?,?,?,?,?,'prepared',?,?,?,?,?,?,?,?,?,?)",
        id,
        user,
        item.project_id,
        item.author_id,
        item.id,
        requestId,
        item.price,
        paid,
        fee,
        Math.floor(((paid - fee) * bps) / 10000),
        [...currencies][0] ?? '',
        bps,
        subscriptionId ?? null,
        payload,
        now,
        now
      ),
    ];
    queries.push(
      this.statement(
        "INSERT INTO points_assertions(id,ok) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM points_items i JOIN projects p ON p.id=i.project_id WHERE i.id=? AND i.enabled=1 AND p.status='Live' AND COALESCE(p.is_deleted,0)=0 AND p.owner_id=i.author_id) THEN 1 ELSE 0 END",
        `item:${id}`,
        item.id
      )
    );
    if (subscriptionId)
      queries.push(
        this.statement(
          'INSERT INTO points_assertions(id,ok) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM points_subscriptions WHERE id=? AND user_id=? AND item_id=? AND active=1 AND due_at=?) THEN 1 ELSE 0 END',
          id,
          subscriptionId,
          user,
          item.id,
          Number(requestId.split(':').at(-1))
        )
      );
    for (const a of allocations) {
      queries.push(
        this.statement(
          'INSERT INTO points_assertions(id,ok) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM points_lots WHERE id=? AND remaining=?) THEN 1 ELSE 0 END',
          `lot:${id}:${a.lot.id}`,
          a.lot.id,
          a.lot.remaining
        )
      );
      queries.push(
        this.statement(
          'INSERT INTO points_allocations(receipt_id,lot_id,points,value_minor,fee_minor) VALUES(?,?,?,?,?)',
          id,
          a.lot.id,
          a.take,
          a.value,
          a.fee
        )
      );
      queries.push(
        this.statement('DELETE FROM points_assertions WHERE id=?', `lot:${id}:${a.lot.id}`)
      );
    }
    if (item.delivery === 'grant') {
      if (item.type === 'durable')
        queries.push(
          this.statement(
            'INSERT INTO points_durable VALUES(?,?,?,?)',
            user,
            item.project_id,
            item.entitlement,
            id
          )
        );
      else if (item.type === 'repeatable')
        queries.push(
          this.statement(
            'INSERT INTO points_grants VALUES(?,?,?,?,?,?)',
            id,
            user,
            item.project_id,
            item.entitlement,
            item.units,
            item.units
          )
        );
      else {
        queries.push(
          this.statement(
            'UPDATE points_receipts SET previous_expiry=COALESCE((SELECT expires_at FROM points_terms WHERE user_id=? AND project_id=? AND entitlement=?),0),previous_receipt=(SELECT receipt_id FROM points_terms WHERE user_id=? AND project_id=? AND entitlement=?) WHERE id=?',
            user,
            item.project_id,
            item.entitlement,
            user,
            item.project_id,
            item.entitlement,
            id
          )
        );
        queries.push(
          this.statement(
            'INSERT INTO points_terms VALUES(?,?,?,?,?) ON CONFLICT(user_id,project_id,entitlement) DO UPDATE SET expires_at=MAX(points_terms.expires_at,?)+?,receipt_id=excluded.receipt_id',
            user,
            item.project_id,
            item.entitlement,
            now + item.period_seconds * 1000,
            id,
            now,
            item.period_seconds * 1000
          )
        );
      }
    }
    queries.push(
      this.statement('UPDATE points_receipts SET status=? WHERE id=?', status, id),
      this.statement('DELETE FROM points_assertions WHERE id=?', `item:${id}`)
    );
    if (subscriptionId)
      queries.push(this.statement('DELETE FROM points_assertions WHERE id=?', id));
    try {
      await this.db.batch(queries);
    } catch {
      const retry = await this.receipt(user, item.project_id, requestId);
      if (retry) return retry;
      if (item.type === 'durable') {
        const owned = await this.statement(
          'SELECT r.* FROM points_durable g JOIN points_receipts r ON g.receipt_id=r.id WHERE g.user_id=? AND g.project_id=? AND g.entitlement=?',
          user,
          item.project_id,
          item.entitlement
        ).first<PointsReceipt>();
        if (owned) return owned;
      }
      if ((await this.balance(user))!.balance < item.price)
        throw new AppError('点数不足。', 402, 'INSUFFICIENT_POINTS');
      throw new AppError('钱包同时有其它消费，请用原请求重试。', 409, 'RETRY_REQUIRED');
    }
    return (await this.receipt(user, item.project_id, requestId))!;
  }
  async grants(user: string, project: string) {
    const [durable, terms, quotas] = await this.db.batch([
      this.statement(
        'SELECT entitlement,receipt_id FROM points_durable WHERE user_id=? AND project_id=?',
        user,
        project
      ),
      this.statement(
        'SELECT entitlement,expires_at,receipt_id FROM points_terms WHERE user_id=? AND project_id=?',
        user,
        project
      ),
      this.statement(
        'SELECT entitlement,receipt_id,remaining,total FROM points_grants WHERE user_id=? AND project_id=? AND remaining>0',
        user,
        project
      ),
    ]);
    return { durable: durable.results, terms: terms.results, quotas: quotas.results };
  }
  async consume(user: string, project: string, grant: string, request: string) {
    const old = await this.statement(
      'SELECT grant_id FROM points_consumptions WHERE user_id=? AND project_id=? AND request_id=?',
      user,
      project,
      request
    ).first<{ grant_id: string }>();
    if (old) {
      if (old.grant_id !== grant)
        throw new AppError('请求 ID 已用于另一项核销。', 409, 'REQUEST_MISMATCH');
      return { consumed: true };
    }
    try {
      await this.statement(
        'INSERT INTO points_consumptions VALUES(?,?,?,?,?)',
        user,
        project,
        request,
        grant,
        Date.now()
      ).run();
    } catch {
      const retry = await this.statement(
        'SELECT grant_id FROM points_consumptions WHERE user_id=? AND project_id=? AND request_id=?',
        user,
        project,
        request
      ).first<{ grant_id: string }>();
      if (retry?.grant_id !== grant)
        throw new AppError('额度不足或不属于此应用。', 409, 'GRANT_UNAVAILABLE');
    }
    return { consumed: true };
  }
}
