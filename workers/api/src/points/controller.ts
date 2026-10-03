import type { ApiWorkerEnv } from '../types/env';
import { AppError } from '../utils/error-handler';
import { jsonResponse, readJson } from '../utils/http';
import { configService } from '../services/config.service';
import { PointsRepository } from './repository';
import { platformUser, sdkIdentity, textInput, integerInput } from './identity';
import { refund, runAi, validateItem } from './service';
import { receiptView, type PointsIntent, type PointsReceipt } from './types';

export async function pointsController(
  request: Request,
  env: ApiWorkerEnv,
  db: D1Database,
  ctx?: ExecutionContext
) {
  const url = new URL(request.url),
    path = url.pathname.replace(/\/+$/, ''),
    repo = new PointsRepository(db);
  const sdk = path.startsWith('/api/v1/sdk/points');
  const identity = sdk ? await sdkIdentity(request, db) : null;
  const user = sdk ? null : await platformUser(request, env, db);
  const uid = identity?.userId || user!.id;
  const tail = path.replace(/^\/api\/v1\/(sdk\/)?points/, '');
  const data = request.method === 'GET' ? {} : await readJson(request);
  const admin = !!user && configService.isAdminUser(user, env);
  const getReceipt = async (id: string) => {
    const r = await repo
      .statement('SELECT * FROM points_receipts WHERE id=?', id)
      .first<PointsReceipt>();
    if (!r) throw new AppError('交易不存在。', 404, 'NOT_FOUND');
    return r;
  };
  const ownProject = async (id: string) => {
    const project = await repo
      .statement(
        'SELECT id,name,owner_id,url FROM projects WHERE id=? AND COALESCE(is_deleted,0)=0',
        id
      )
      .first<{ id: string; name: string; owner_id: string; url: string }>();
    if (!project || project.owner_id !== uid)
      throw new AppError('无权管理此应用。', 403, 'FORBIDDEN');
    return project;
  };
  if (!sdk && tail === '/wallet' && request.method === 'GET') {
    const [lots, receipts, settings, subscriptions] = await db.batch([
      repo.statement(
        'SELECT id,kind,total,remaining,paid_minor,currency,created_at FROM points_lots WHERE user_id=? ORDER BY created_at DESC LIMIT 100',
        uid
      ),
      repo.statement(
        'SELECT r.*,i.name,p.name app_name,p.url app_url FROM points_receipts r JOIN points_items i ON i.id=r.item_id JOIN projects p ON p.id=r.project_id WHERE r.user_id=? ORDER BY r.created_at DESC LIMIT 100',
        uid
      ),
      repo.statement(
        'SELECT trial_points,trial_budget,trial_issued,live_payments FROM points_settings WHERE id=1'
      ),
      repo.statement(
        'SELECT s.*,i.name,p.name app_name FROM points_subscriptions s JOIN points_items i ON i.id=s.item_id JOIN projects p ON p.id=s.project_id WHERE s.user_id=?',
        uid
      ),
    ]);
    return jsonResponse({
      ...(await repo.balance(uid)),
      lots: lots.results,
      receipts: receipts.results,
      settings: settings.results[0],
      subscriptions: subscriptions.results,
      paymentStatus: '商户与支付渠道尚未开通，真钱充值不可用。体验点无现金价值。',
    });
  }
  if (!sdk && tail === '/claim' && request.method === 'POST')
    return jsonResponse({ ...(await repo.claim(uid)), ...(await repo.balance(uid)) });
  if (!sdk && tail === '/recharge' && request.method === 'POST')
    throw new AppError(
      '真钱充值尚未开通：需要经营主体、商户账户与跨应用点数交易准入。',
      503,
      'PAYMENTS_UNAVAILABLE'
    );
  if (!sdk && tail === '/operations' && request.method === 'GET') {
    if (!admin) throw new AppError('仅平台管理员可核查服务。', 403, 'FORBIDDEN');
    const [settings, pending] = await db.batch([
      repo.statement(
        'SELECT trial_points,trial_budget,trial_issued,ai_daily_limit FROM points_settings WHERE id=1'
      ),
      repo.statement(
        "SELECT r.id,r.request_id,r.status,r.error,r.created_at,i.name,p.name app_name FROM points_receipts r JOIN points_items i ON i.id=r.item_id JOIN projects p ON p.id=r.project_id WHERE r.status IN('unknown','reserved','running') ORDER BY r.created_at LIMIT 100"
      ),
    ]);
    return jsonResponse({ settings: settings.results[0], pending: pending.results });
  }
  if (!sdk && tail === '/settings' && request.method === 'POST') {
    if (!admin) throw new AppError('仅平台管理员可调整补贴规则。', 403, 'FORBIDDEN');
    const trial = integerInput(data.trialPoints, '体验点', 0, 1000),
      budget = integerInput(data.trialBudget, '体验点总预算', 0, 1000000),
      ai = integerInput(data.aiDailyLimit, 'AI 日上限', 0, 100);
    await repo
      .statement(
        'UPDATE points_settings SET trial_points=?,trial_budget=?,ai_daily_limit=? WHERE id=1',
        trial,
        budget,
        ai
      )
      .run();
    return jsonResponse({ updated: true });
  }
  const projectMatch = tail.match(/^\/projects\/([^/]+)(\/items)?$/);
  if (!sdk && projectMatch) {
    const project = await ownProject(projectMatch[1]);
    if (request.method === 'GET') {
      const [items, sales] = await db.batch([
        repo.statement(
          'SELECT * FROM points_items WHERE project_id=? ORDER BY created_at DESC',
          project.id
        ),
        repo.statement(
          'SELECT r.id,r.item_id,r.request_id,r.status,r.price,r.paid_minor,r.creator_minor,r.currency,r.created_at,r.error,i.name FROM points_receipts r JOIN points_items i ON r.item_id=i.id WHERE r.project_id=? ORDER BY r.created_at DESC LIMIT 100',
          project.id
        ),
      ]);
      return jsonResponse({
        project,
        items: items.results,
        sales: sales.results,
        cashEnabled: false,
      });
    }
    if (request.method === 'POST' && projectMatch[2]) {
      const { type, delivery } = validateItem(data);
      const name = textInput(data.name, '名称', 80),
        description = textInput(data.description, '说明', 300),
        entitlement = textInput(data.entitlement, '权益键', 80),
        price = integerInput(data.price, '点数', 1, 100000),
        units = integerInput(data.units ?? 1, '数量', 1, 10000),
        period = type === 'term' ? integerInput(data.periodSeconds, '有效期', 60, 31536000) : 0;
      if (!/^[a-z0-9_-]+$/.test(entitlement))
        throw new AppError('权益键仅使用小写字母、数字、下划线和短横线。', 400, 'INVALID_INPUT');
      if (delivery === 'ai' && !env.RECOMMENDATION_AI)
        throw new AppError('AI 服务暂不可用。', 503, 'SERVICE_UNAVAILABLE');
      const id = crypto.randomUUID();
      await repo
        .statement(
          'INSERT INTO points_items VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
          id,
          project.id,
          uid,
          name,
          description,
          type,
          price,
          entitlement,
          units,
          period,
          delivery,
          1,
          Date.now()
        )
        .run();
      return jsonResponse(await repo.item(id), 201);
    }
  }
  const itemMatch = tail.match(/^\/items\/([^/]+)$/);
  if (!sdk && itemMatch && request.method === 'PATCH') {
    const item = await repo.item(itemMatch[1]);
    if (!item) throw new AppError('收费项不存在。', 404, 'NOT_FOUND');
    await ownProject(item.project_id);
    if (typeof data.enabled !== 'boolean')
      throw new AppError('请选择启用或停用。', 400, 'INVALID_INPUT');
    await repo
      .statement('UPDATE points_items SET enabled=? WHERE id=?', data.enabled ? 1 : 0, item.id)
      .run();
    return jsonResponse({ updated: true });
  }
  if (sdk && tail === '/items' && request.method === 'GET')
    return jsonResponse(
      (
        await repo
          .statement(
            'SELECT id,name,description,type,price,entitlement,units,period_seconds,delivery,enabled FROM points_items WHERE project_id=? AND enabled=1',
            identity!.project.id
          )
          .all()
      ).results
    );
  if (sdk && tail === '/grants' && request.method === 'GET')
    return jsonResponse(await repo.grants(uid, identity!.project.id));
  if (sdk && tail === '/consume' && request.method === 'POST')
    return jsonResponse(
      await repo.consume(
        uid,
        identity!.project.id,
        textInput(data.grantId, 'grantId'),
        textInput(data.requestId, 'requestId')
      )
    );
  if (sdk && tail === '/receipt' && request.method === 'GET') {
    const requestId = url.searchParams.get('requestId'),
      id = url.searchParams.get('id');
    let receipt = id
      ? await getReceipt(id)
      : await repo.receipt(uid, identity!.project.id, textInput(requestId, 'requestId'));
    if (!receipt && requestId) {
      const owned = await repo
        .statement(
          'SELECT r.* FROM points_intents t JOIN points_items i ON i.id=t.item_id JOIN points_durable g ON g.user_id=t.user_id AND g.project_id=t.project_id AND g.entitlement=i.entitlement JOIN points_receipts r ON r.id=g.receipt_id WHERE t.user_id=? AND t.project_id=? AND t.request_id=?',
          uid,
          identity!.project.id,
          requestId
        )
        .first<PointsReceipt>();
      receipt = owned;
    }
    if (receipt && (receipt.user_id !== uid || receipt.project_id !== identity!.project.id))
      throw new AppError('无权读取此消费。', 403, 'FORBIDDEN');
    return jsonResponse(receipt ? receiptView(receipt) : null);
  }
  if (sdk && tail === '/intents' && request.method === 'POST') {
    const itemId = textInput(data.itemId, 'itemId'),
      requestId = textInput(data.requestId, 'requestId'),
      state = textInput(data.state, 'state');
    const item = await repo.item(itemId);
    if (!item?.enabled || item.project_id !== identity!.project.id)
      throw new AppError('收费项不可用或属于另一应用。', 403, 'ITEM_UNAVAILABLE');
    const topic = item.delivery === 'ai' ? textInput(data.topic, '知识主题', 160) : null;
    const old = await repo
      .statement(
        'SELECT * FROM points_intents WHERE user_id=? AND project_id=? AND request_id=?',
        uid,
        item.project_id,
        requestId
      )
      .first<PointsIntent>();
    if (old) {
      if (old.item_id !== itemId || old.origin !== identity!.origin)
        throw new AppError('请求 ID 已用于另一消费。', 409, 'REQUEST_MISMATCH');
      if (item.delivery === 'ai') {
        const payload = await repo
          .statement('SELECT payload FROM points_intent_payloads WHERE id=?', old.id)
          .first<{ payload: string }>();
        if (JSON.parse(payload?.payload || '{}').topic !== topic)
          throw new AppError('请求 ID 已用于另一服务输入。', 409, 'REQUEST_MISMATCH');
      }
      if (old.expires_at <= Date.now() && !(await repo.receipt(uid, item.project_id, requestId))) {
        await repo
          .statement(
            'UPDATE points_intents SET expires_at=? WHERE id=?',
            Date.now() + 600000,
            old.id
          )
          .run();
        old.expires_at = Date.now() + 600000;
      }
      return jsonResponse(old);
    }
    const id = crypto.randomUUID(),
      now = Date.now();
    // Input is normalized before comparing retries and stored atomically with the intent.
    const count = await repo
      .statement(
        'SELECT COUNT(*) count FROM points_intents WHERE user_id=? AND created_at>?',
        uid,
        now - 3600000
      )
      .first<{ count: number }>();
    if ((count?.count || 0) >= 100)
      throw new AppError('消费意图过多，请稍后再试。', 429, 'RATE_LIMIT');
    const writes = [
      repo.statement(
        'INSERT INTO points_intents VALUES(?,?,?,?,?,?,?,?,?)',
        id,
        uid,
        item.project_id,
        itemId,
        requestId,
        identity!.origin,
        state,
        now,
        now + 600000
      ),
    ];
    if (topic)
      writes.push(
        repo.statement(
          'INSERT INTO points_intent_payloads(id,payload) VALUES(?,?)',
          id,
          JSON.stringify({ topic })
        )
      );
    try {
      await repo.db.batch(writes);
    } catch (error) {
      const retry = await repo
        .statement(
          'SELECT * FROM points_intents WHERE user_id=? AND project_id=? AND request_id=?',
          uid,
          item.project_id,
          requestId
        )
        .first<PointsIntent>();
      if (retry && retry.item_id === itemId && retry.origin === identity!.origin) {
        const bound = await repo
          .statement('SELECT payload FROM points_intent_payloads WHERE id=?', retry.id)
          .first<{ payload: string }>();
        if (item.delivery === 'ai' && JSON.parse(bound?.payload || '{}').topic !== topic)
          throw new AppError('请求 ID 已用于另一服务输入。', 409, 'REQUEST_MISMATCH');
        return jsonResponse(retry);
      }
      throw error;
    }
    return jsonResponse(
      await repo.statement('SELECT * FROM points_intents WHERE id=?', id).first()
    );
  }
  const intentMatch = tail.match(/^\/intents\/([^/]+)(\/confirm)?$/);
  if (!sdk && intentMatch) {
    const intent = await repo
      .statement('SELECT * FROM points_intents WHERE id=?', intentMatch[1])
      .first<PointsIntent>();
    if (!intent || intent.user_id !== uid)
      throw new AppError('请使用应用内同一个账号登录。', 403, 'ACCOUNT_MISMATCH');
    const item = (await repo.item(intent.item_id))!;
    const app = await repo
      .statement(
        "SELECT name,url,owner_id FROM projects WHERE id=? AND status='Live' AND COALESCE(is_deleted,0)=0",
        intent.project_id
      )
      .first<{ name: string; url: string; owner_id: string }>();
    if (!app || new URL(app.url).origin !== intent.origin || app.owner_id !== item.author_id)
      throw new AppError('应用已变更，请重新发起消费。', 403, 'SOURCE_MISMATCH');
    const receipt = await repo.receipt(uid, item.project_id, intent.request_id);
    const serviceInput = await repo
      .statement('SELECT payload FROM points_intent_payloads WHERE id=?', intent.id)
      .first<{ payload: string }>();
    if (request.method === 'GET')
      return jsonResponse({
        intent,
        serviceInput: serviceInput ? JSON.parse(serviceInput.payload) : null,
        item,
        app,
        balance: await repo.balance(uid),
        receipt: receipt ? receiptView(receipt) : null,
        expired: intent.expires_at <= Date.now(),
      });
    if (request.method === 'POST' && intentMatch[2]) {
      if (!receipt && (intent.expires_at <= Date.now() || !item.enabled))
        throw new AppError('消费意图已过期或收费项已停用，请重新发起。', 409, 'INTENT_EXPIRED');
      if (!receipt && item.delivery === 'ai' && !env.RECOMMENDATION_AI)
        throw new AppError('AI 服务暂不可用，未扣点。', 503, 'SERVICE_UNAVAILABLE');
      const payload = await repo
        .statement('SELECT payload FROM points_intent_payloads WHERE id=?', intent.id)
        .first<{ payload: string }>();
      const result =
        receipt || (await repo.purchase(uid, item, intent.request_id, payload?.payload || null));
      if (data.subscribe === true) {
        if (item.type !== 'term' || !item.enabled || result.status !== 'granted')
          throw new AppError('此项不支持自动续费。', 400, 'INVALID_INPUT');
        const term = await repo
          .statement(
            'SELECT expires_at FROM points_terms WHERE user_id=? AND project_id=? AND entitlement=?',
            uid,
            item.project_id,
            item.entitlement
          )
          .first<{ expires_at: number }>();
        await repo
          .statement(
            'INSERT INTO points_subscriptions VALUES(?,?,?,?,1,?,?) ON CONFLICT(user_id,project_id,item_id) DO UPDATE SET active=1,due_at=excluded.due_at',
            crypto.randomUUID(),
            uid,
            item.project_id,
            item.id,
            term?.expires_at ?? result.created_at + item.period_seconds * 1000,
            Date.now()
          )
          .run();
      }
      if (result.status === 'reserved' && env.RECOMMENDATION_AI)
        ctx?.waitUntil(runAi(env, repo, result));
      return jsonResponse(receiptView(result));
    }
  }
  const cancel = tail.match(/^\/subscriptions\/([^/]+)\/cancel$/);
  if (!sdk && cancel && request.method === 'POST') {
    await repo
      .statement(
        'UPDATE points_subscriptions SET active=0 WHERE id=? AND user_id=?',
        cancel[1],
        uid
      )
      .run();
    return jsonResponse({ cancelled: true });
  }
  const refundMatch = tail.match(/^\/receipts\/([^/]+)\/(refund|release)$/);
  if (!sdk && refundMatch && request.method === 'POST') {
    const r = await getReceipt(refundMatch[1]);
    if (!admin && r.author_id !== uid)
      throw new AppError('仅作者或平台可处理退款。', 403, 'FORBIDDEN');
    if (refundMatch[2] === 'release' && (!admin || !['unknown', 'reserved'].includes(r.status)))
      throw new AppError('仅平台可释放待核查服务。', 403, 'FORBIDDEN');
    await refund(repo, r, refundMatch[2] === 'release');
    return jsonResponse({ refunded: true });
  }
  throw new AppError('点数接口不存在。', 404, 'NOT_FOUND');
}
