// Dependency-free public contract shared by the browser and API. Never import server code here.
export const EVENTS = {
  page_view: ['页面访问', '访问', 'browser'],
  navigation_click: ['导航点击', '访问', 'browser'],
  quick_deploy_click: ['快速部署入口', '部署', 'browser'],
  project_create_click: ['点击创建项目', '部署', 'browser'],
  project_created: ['项目创建成功', '部署', 'server'],
  source_select: ['切换部署来源', '部署', 'browser'],
  deployment_start: ['开始部署', '部署', 'browser'],
  deployment_accepted: ['部署请求受理', '部署', 'server'],
  deployment_rejected: ['部署请求拒绝', '部署', 'server'],
  deployment_success: ['浏览器收到部署成功', '部署', 'browser'],
  deployment_failure: ['浏览器收到部署失败', '部署', 'browser'],
  app_preview: ['预览应用', '发现', 'browser'],
  app_visit: ['打开应用网站', '发现', 'browser'],
  author_open: ['打开作者主页', '发现', 'browser'],
  search_submit: ['搜索应用', '发现', 'browser'],
  filter_change: ['筛选应用', '发现', 'browser'],
  sort_change: ['切换排序', '发现', 'browser'],
  load_more: ['加载更多应用', '发现', 'browser'],
  auth_open: ['打开登录 / 注册', '账号', 'browser'],
  auth_submit: ['提交登录 / 注册', '账号', 'browser'],
  login_success: ['邮箱登录成功', '账号', 'server'],
  signup_success: ['邮箱注册成功', '账号', 'server'],
  oauth_start: ['发起第三方登录', '账号', 'browser'],
  reaction_click: ['点赞 / 收藏', '互动', 'browser'],
  comment_submit: ['提交评论', '互动', 'browser'],
  share_click: ['分享 / 复制链接', '互动', 'browser'],
  settings_tab: ['切换项目设置', '管理', 'browser'],
  profile_save: ['保存个人主页', '管理', 'browser'],
  theme_change: ['切换主题', '偏好', 'browser'],
  language_change: ['切换语言', '偏好', 'browser'],
  help_open: ['打开帮助', '偏好', 'browser'],
  client_error: ['前端运行错误', '质量', 'browser'],
} as const;
export type EventName = keyof typeof EVENTS;
export type Device = 'desktop' | 'mobile' | 'tablet';
export const PAGES = [
  'home',
  'explore',
  'new_project',
  'project',
  'dashboard',
  'profile',
  'creator',
  'privacy',
  'other',
] as const;
export type PageName = (typeof PAGES)[number];
export const DIMENSIONS = [
  'github',
  'zip',
  'html',
  'login',
  'signup',
  'google',
  'email',
  'like',
  'favorite',
  'general',
  'deployments',
  'showcase',
  'cloud-db',
  'analytics',
  'light',
  'dark',
  'zh',
  'en',
  'recent',
  'popular',
  'all',
  'development',
  'image-gen',
  'productivity',
  'marketing',
  'legal',
  'fun',
  'other',
  'navigation',
  'header',
  'home',
  'profile',
  'preview',
  'runtime',
  'promise',
] as const;
export interface ProductEvent {
  id: string;
  name: EventName;
  at: number;
  page: PageName;
  dimension?: string;
  durationMs?: number;
  flowId?: string;
}
export interface EventBatch {
  visitorId: string;
  sessionId: string;
  device: Device;
  referrer: 'direct' | 'search' | 'social' | 'github' | 'other';
  events: ProductEvent[];
}
export const normalizePage = (path: string): PageName => {
  const clean = path.split('?')[0].replace(/\/+$/, '') || '/';
  if (clean === '/') return 'home';
  if (clean === '/explore') return 'explore';
  if (clean === '/deploy') return 'new_project';
  if (/^\/projects\/[^/]+$/.test(clean)) return 'project';
  if (clean === '/dashboard') return 'dashboard';
  if (clean === '/me') return 'profile';
  if (/^\/u\/[^/]+$/.test(clean)) return 'creator';
  if (clean === '/privacy' || clean === '/privacy-policy') return 'privacy';
  return 'other';
};
export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
export const parseBatch = (value: unknown, now = Date.now()): EventBatch => {
  if (!value || typeof value !== 'object') throw new Error('Invalid batch');
  const b = value as Record<string, unknown>;
  if (!isUuid(b.visitorId) || !isUuid(b.sessionId)) throw new Error('Invalid identifiers');
  if (!['desktop', 'mobile', 'tablet'].includes(String(b.device)))
    throw new Error('Invalid device');
  if (!['direct', 'search', 'social', 'github', 'other'].includes(String(b.referrer)))
    throw new Error('Invalid referrer');
  if (!Array.isArray(b.events) || b.events.length > 20) throw new Error('Expected 0–20 events');
  const events = b.events.map((raw): ProductEvent => {
    if (!raw || typeof raw !== 'object') throw new Error('Invalid event');
    const e = raw as Record<string, unknown>;
    const name = e.name as EventName;
    if (!Object.hasOwn(EVENTS, name) || EVENTS[name][2] !== 'browser')
      throw new Error('Invalid event name');
    if (!isUuid(e.id) || !PAGES.includes(e.page as PageName))
      throw new Error('Invalid event identity');
    if (
      typeof e.at !== 'number' ||
      !Number.isFinite(e.at) ||
      e.at < now - 86400000 ||
      e.at > now + 300000
    )
      throw new Error('Invalid timestamp');
    if (
      e.dimension !== undefined &&
      !DIMENSIONS.includes(e.dimension as (typeof DIMENSIONS)[number])
    )
      throw new Error('Invalid dimension');
    if (e.flowId !== undefined && !isUuid(e.flowId)) throw new Error('Invalid flow');
    if (
      e.durationMs !== undefined &&
      (typeof e.durationMs !== 'number' ||
        !Number.isFinite(e.durationMs) ||
        e.durationMs < 0 ||
        e.durationMs > 86400000)
    )
      throw new Error('Invalid duration');
    return {
      id: e.id,
      name,
      at: Math.round(e.at),
      page: e.page as PageName,
      ...(e.dimension ? { dimension: String(e.dimension) } : {}),
      ...(e.flowId ? { flowId: String(e.flowId) } : {}),
      ...(typeof e.durationMs === 'number' ? { durationMs: Math.round(e.durationMs) } : {}),
    };
  });
  return {
    visitorId: b.visitorId,
    sessionId: b.sessionId,
    device: b.device as Device,
    referrer: b.referrer as EventBatch['referrer'],
    events,
  };
};
