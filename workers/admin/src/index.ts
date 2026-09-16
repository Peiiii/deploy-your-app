import {
  cleanupAnalytics,
  dayKey,
  getBudget,
  parseFilter,
  queryAnalytics,
  queryEventDetails,
  reserve,
} from '@gemigo/product-analytics';
import { authenticated, createSession, hash, logout, verifyPassword, type AdminEnv } from './auth';

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
  if (text.length > 2048) throw new Error('请求过大');
  return JSON.parse(text) as Record<string, unknown>;
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
      `${dayKey()}:${env.ADMIN_PASSWORD_HASH}:${request.headers.get('cf-connecting-ip') || 'local'}`
    );
    if (!(await reserve(env.ANALYTICS_DB, `login:${dayKey()}:${ipKey}`, 1, 10)))
      return json({ error: '尝试次数过多，请明天再试。' }, 429);
    const input = await body(request);
    const valid =
      typeof input.password === 'string' &&
      (await verifyPassword(input.password, env.ADMIN_PASSWORD_HASH || ''));
    if (!valid || input.username !== env.ADMIN_USERNAME)
      return json({ error: '账号或密码不正确' }, 401);
    return json({ ok: true }, 200, { 'Set-Cookie': await createSession(env) });
  }
  if (!(await authenticated(request, env))) return json({ error: '请登录独立管理账号' }, 401);
  if (url.pathname === '/api/session') return json({ username: env.ADMIN_USERNAME });
  if (url.pathname === '/api/logout' && request.method === 'POST')
    return json({ ok: true }, 200, { 'Set-Cookie': await logout(request, env) });
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
    const cache = await caches.open('gemigo-analytics-v1');
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
    const cost = (Math.ceil((filter.to - filter.from) / 86400000) + 2) * 2000 * 4 + 100;
    if (!(await reserve(env.ANALYTICS_DB, `reads:${dayKey()}`, cost, 1000000)))
      return json({ error: '今日查询预算已用完，请明天再试。' }, 429);
    return json(await queryEventDetails(env.ANALYTICS_DB, filter, url));
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
            error instanceof Error && /预算|date|range|filter|请求/.test(error.message)
              ? error.message
              : '请求失败，请稍后重试。',
        },
        400
      );
    }
  },
  scheduled: async (_controller: ScheduledController, env: AdminEnv) => {
    await cleanupAnalytics(env.ANALYTICS_DB);
    await env.ANALYTICS_DB.prepare('DELETE FROM admin_sessions WHERE expires_at < ?')
      .bind(Date.now())
      .run();
  },
} satisfies ExportedHandler<AdminEnv>;
