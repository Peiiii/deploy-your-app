import { queryAcquisition } from './acquisition';
import { projectDetail } from './project-detail';
import {
  cleanupAnalytics,
  dayKey,
  getBudget,
  parseFilter,
  queryAnalytics,
  queryEventDetails,
  reserve,
  recordReads,
  allowAdminRead,
} from '@gemigo/product-analytics';
import {
  authenticated,
  adminSessionToken,
  changePassword,
  credential,
  initializeAccount,
  createSession,
  hash,
  logout,
  verifyPassword,
  type AdminEnv,
} from './auth';
import { maintenanceService } from './maintenance';
import { AdminInputError, listOperations, manageOperation, overview } from './operations';
import { listFeedback, feedbackDetail, manageFeedback } from './feedback';
import { getGrowthReport } from './growth';

const json = (value: unknown, status = 200, extra: HeadersInit = {}) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extra,
    },
  });
const body = async (request: Request) => {
  const text = await request.text();
  if (text.length > 2048) throw new AdminInputError('请求过大');
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new AdminInputError('请求 JSON 无效');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new AdminInputError('请求参数无效');
  return value as Record<string, unknown>;
};
const handle = async (
  request: Request,
  env: AdminEnv,
  ctx: ExecutionContext
): Promise<Response> => {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
  if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Method not allowed' }, 405);
  if (request.method === 'POST' && request.headers.get('origin') !== url.origin)
    return json({ error: 'Origin denied' }, 403);
  if (url.pathname === '/api/login' && request.method === 'POST') {
    // No IP is stored: salted daily hash expires after 48h. Limit before expensive hashing.
    const ipKey = await hash(
      `${dayKey()}:${env.ADMIN_PASSWORD_HASH}:admin-login:${request.headers.get('cf-connecting-ip') || 'local'}`
    );
    if (
      !(await reserve(env.ANALYTICS_DB, `login:${Math.floor(Date.now() / 600000)}:${ipKey}`, 1, 20))
    )
      return json({ error: '尝试次数过多，请 10 分钟后再试。' }, 429);
    const input = await body(request);
    await initializeAccount(env);
    const current = await credential(env);
    const valid =
      typeof input.password === 'string' &&
      input.password.length <= 256 &&
      (await verifyPassword(input.password, current.password_hash));
    if (!valid || input.username !== env.ADMIN_USERNAME)
      return json({ error: '账号或密码不正确' }, 401);
    return json({ ok: true }, 200, { 'Set-Cookie': await createSession(env, current.version) });
  }
  if (!(await authenticated(request, env))) return json({ error: '请登录独立管理账号' }, 401);
  if (
    request.method === 'GET' &&
    (['/api/growth', '/api/acquisition', '/api/report', '/api/events'].includes(url.pathname) ||
      url.pathname.startsWith('/api/projects/'))
  ) {
    const now = Date.now();
    if (
      !(await allowAdminRead(env.ANALYTICS_DB, await hash(adminSessionToken(request) || ''), now))
    )
      return json({ error: '查询过于频繁，请稍后再试。' }, 429, {
        'Retry-After': String(60 - (Math.floor(now / 1000) % 60)),
      });
  }
  if (url.pathname === '/api/session') return json({ username: env.ADMIN_USERNAME });
  if (url.pathname === '/api/logout' && request.method === 'POST')
    return json({ ok: true }, 200, { 'Set-Cookie': await logout(request, env) });
  if (url.pathname === '/api/password' && request.method === 'POST') {
    const input = await body(request);
    if (
      typeof input.currentPassword !== 'string' ||
      input.currentPassword.length > 256 ||
      typeof input.newPassword !== 'string' ||
      input.newPassword.length < 8 ||
      input.newPassword.length > 256 ||
      input.newPassword !== input.confirmPassword ||
      input.newPassword === input.currentPassword
    )
      return json({ error: '新密码须为 8–256 字符、两次一致，且不同于当前密码' }, 400);
    const key = await hash(request.headers.get('cookie') || '');
    if (!(await reserve(env.ANALYTICS_DB, `password:${dayKey()}:${key}`, 1, 10)))
      return json({ error: '修改尝试过多，请明天再试' }, 429);
    await initializeAccount(env);
    const current = await credential(env);
    if (!(await verifyPassword(input.currentPassword, current.password_hash)))
      return json({ error: '当前密码不正确' }, 400);
    if (!(await changePassword(env, current, input.newPassword)))
      return json({ error: '密码已被更改，请重新登录' }, 409);
    return json({ ok: true }, 200, { 'Set-Cookie': await logout(request, env) });
  }
  if (url.pathname === '/api/acquisition' && request.method === 'GET') {
    const days = Number(url.searchParams.get('days') || 7);
    if (![7, 30].includes(days)) throw new AdminInputError('请选择近 7 天或 30 天');
    const cache = await caches.open('gemigo-acquisition-v3');
    const key = new Request(`${url.origin}/__acquisition-cache/${dayKey()}/${days}`);
    const cached = await cache.match(key);
    if (cached) return json({ ...((await cached.json()) as object), cached: true });
    const report = await queryAcquisition(env.ANALYTICS_DB, days);
    ctx.waitUntil(
      cache.put(
        key,
        new Response(JSON.stringify(report), { headers: { 'Cache-Control': 'max-age=900' } })
      )
    );
    return json({ ...report, cached: false });
  }
  if (url.pathname === '/api/growth' && request.method === 'GET') {
    return json(await getGrowthReport(env, url));
  }
  if (url.pathname === '/api/overview' && request.method === 'GET')
    return json(await overview(env.ANALYTICS_DB, url));
  if (url.pathname === '/api/feedback' && request.method === 'GET')
    return json(await listFeedback(env.ANALYTICS_DB, url));
  if (url.pathname === '/api/feedback/manage' && request.method === 'POST')
    return json(await manageFeedback(env, await body(request)));
  if (url.pathname.startsWith('/api/feedback/') && request.method === 'GET')
    return json(
      await feedbackDetail(
        env.ANALYTICS_DB,
        url,
        decodeURIComponent(url.pathname.slice('/api/feedback/'.length))
      )
    );
  if (url.pathname.startsWith('/api/projects/') && request.method === 'GET')
    return json(
      await projectDetail(
        env.ANALYTICS_DB,
        decodeURIComponent(url.pathname.slice('/api/projects/'.length)),
        url
      )
    );
  const kind = url.pathname.slice('/api/'.length);
  if (['users', 'projects', 'deployments', 'audit'].includes(kind) && request.method === 'GET')
    return json(await listOperations(env.ANALYTICS_DB, kind, url));
  if (url.pathname === '/api/manage' && request.method === 'POST')
    return json(await manageOperation(env, await body(request)));
  if (url.pathname === '/api/settings' && request.method === 'POST') {
    const input = await body(request);
    if (
      typeof input.enabled !== 'boolean' ||
      !Number.isInteger(input.dailyEvents) ||
      Number(input.dailyEvents) < 100 ||
      Number(input.dailyEvents) > 2000
    )
      return json({ error: '每日事件预算应为 100–2000 的整数' }, 400);
    await env.ANALYTICS_DB.prepare(
      "INSERT INTO analytics_settings VALUES ('collection',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
    )
      .bind(JSON.stringify({ enabled: input.enabled, dailyEvents: input.dailyEvents }))
      .run();
    return json(await getBudget(env.ANALYTICS_DB));
  }
  if (url.pathname === '/api/budget') return json(await getBudget(env.ANALYTICS_DB));
  if (url.pathname === '/api/report') {
    const filter = parseFilter(url);
    const key = new Request(`${url.origin}/__report-cache/${await hash(JSON.stringify(filter))}`);
    const cache = await caches.open('gemigo-analytics-v2');
    const cached = await cache.match(key);
    if (cached) return json({ ...((await cached.json()) as object), cached: true });
    const report = await queryAnalytics(env.ANALYTICS_DB, filter);
    ctx.waitUntil(
      cache.put(
        key,
        new Response(JSON.stringify(report), {
          headers: { 'Cache-Control': 'max-age=900', 'Content-Type': 'application/json' },
        })
      )
    );
    return json({ ...report, cached: false });
  }
  if (url.pathname === '/api/events') {
    const filter = parseFilter(url);
    const details = await queryEventDetails(env.ANALYTICS_DB, filter, url);
    await recordReads(env.ANALYTICS_DB, `analysis_reads:${dayKey()}`, details.rowsRead);
    return json(details);
  }
  return json({ error: 'Not found' }, 404);
};
export default {
  fetch: async (request: Request, env: AdminEnv, ctx: ExecutionContext) => {
    try {
      return await handle(request, env, ctx);
    } catch (error) {
      return json(
        {
          error:
            error instanceof AdminInputError ||
            (error instanceof Error && /预算|date|range|filter|请求/.test(error.message))
              ? error.message
              : '请求失败，请稍后重试。',
        },
        error instanceof AdminInputError
          ? error.status
          : error instanceof Error && /预算|date|range|filter|请求/.test(error.message)
            ? 400
            : 500
      );
    }
  },
  scheduled: async (_controller: ScheduledController, env: AdminEnv) => {
    await cleanupAnalytics(env.ANALYTICS_DB);
    await maintenanceService.runDaily(env.ANALYTICS_DB);
    await env.ANALYTICS_DB.prepare('DELETE FROM admin_sessions WHERE expires_at < ?')
      .bind(Date.now())
      .run();
  },
} satisfies ExportedHandler<AdminEnv>;
