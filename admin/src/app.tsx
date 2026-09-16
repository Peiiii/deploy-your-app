import { useEffect, useState, type FormEvent } from 'react';
import { EVENTS, type queryAnalytics, type getBudget } from '@gemigo/product-analytics';
import './style.css';

type Report = Awaited<ReturnType<typeof queryAnalytics>> & { cached: boolean };
type Budget = Awaited<ReturnType<typeof getBudget>>;
type EventRow = {
  id: string;
  name: keyof typeof EVENTS;
  at: number;
  page: string;
  dimension: string | null;
  source: string;
  sessionId: string;
  device: string;
};
type Details = { items: EventRow[]; total: number; page: number; limit: number };
const today = () => new Date().toISOString().slice(0, 10);
const dateAgo = (days: number) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
const number = (n: number) => n.toLocaleString('zh-CN');
const time = (n: number) => new Date(n).toLocaleString('zh-CN', { hour12: false });
const api = async <T,>(path: string, data?: object): Promise<T> => {
  const response = await fetch(
    '/api/' + path,
    data
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      : undefined
  );
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 && path !== 'login')
      window.dispatchEvent(new Event('admin-session-expired'));
    throw new Error(result.error || '请求失败');
  }
  return result;
};
const Empty = ({ text = '这段时间还没有采集到数据' }: { text?: string }) => (
  <div className="empty">
    <span>◌</span>
    <p>{text}</p>
    <small>数据从上线后开始积累；不补造历史记录。</small>
  </div>
);
const Trend = ({ report }: { report: Report }) => {
  const max = Math.max(1, ...report.daily.map((d) => d.events));
  return report.daily.length ? (
    <div className="trend" role="img" aria-label="每日事件趋势">
      {report.daily.map((d) => (
        <div className="bar-column" key={d.day}>
          <span>{number(d.events)}</span>
          <div
            className="bar"
            style={{ height: `${Math.max(3, (d.events / max) * 130)}px` }}
            title={`${d.day} · ${d.events} 事件 · ${d.visitors} 访客`}
          />
          <small>{d.day.slice(5)}</small>
        </div>
      ))}
    </div>
  ) : (
    <Empty />
  );
};
const Funnel = ({ title, steps }: { title: string; steps: Report['funnels']['creation'] }) => (
  <article className="panel">
    <h3>{title}</h3>
    <p className="muted">同一会话内按顺序完成，窗口以所选日期为准。</p>
    <div className="funnel">
      {steps.map((step, i) => (
        <div key={step.name}>
          <div className="spread">
            <span>
              {i + 1}. {EVENTS[step.name as keyof typeof EVENTS][0]}
            </span>
            <strong>{number(step.sessions)}</strong>
          </div>
          <div className="track">
            <i
              style={{
                width: `${steps[0].sessions ? (step.sessions / steps[0].sessions) * 100 : 0}%`,
              }}
            />
          </div>
          <small>
            {steps[0].sessions
              ? ((step.sessions / steps[0].sessions) * 100).toFixed(1) + '% 入口转化'
              : '暂无入口数据'}
          </small>
        </div>
      ))}
    </div>
  </article>
);
export default function App() {
  const [signedIn, setSignedIn] = useState(false);
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState('overview');
  const [from, setFrom] = useState(dateAgo(6));
  const [to, setTo] = useState(today());
  const [device, setDevice] = useState('all');
  const [audience, setAudience] = useState('all');
  const [includeAdmin, setIncludeAdmin] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [details, setDetails] = useState<Details | null>(null);
  const [eventName, setEventName] = useState('');
  const [session, setSession] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [dailyEvents, setDailyEvents] = useState(2000);
  const [notice, setNotice] = useState('');
  const [applied, setApplied] = useState('');
  const params = () =>
    new URLSearchParams({ from, to, device, audience, includeAdmin: String(includeAdmin) });
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败');
    } finally {
      setBusy(false);
    }
  };
  const load = async () => {
    const query = params().toString();
    const [r, b] = await Promise.all([api<Report>('report?' + query), api<Budget>('budget')]);
    setReport(r);
    setBudget(b);
    setEnabled(b.settings.enabled);
    setDailyEvents(b.settings.dailyEvents);
    setApplied(`${from} — ${to} · ${device} · ${audience}${includeAdmin ? ' · 含管理员' : ''}`);
  };
  useEffect(() => {
    void api<{ username: string }>('session')
      .then((result) => {
        setUsername(result.username);
        setSignedIn(true);
      })
      .catch(() => undefined)
      .finally(() => setChecking(false));
    const expired = () => {
      setSignedIn(false);
      setReport(null);
      setDetails(null);
    };
    window.addEventListener('admin-session-expired', expired);
    return () => window.removeEventListener('admin-session-expired', expired);
  }, []);
  const login = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await api('login', { username, password });
      setPassword('');
      setSignedIn(true);
      await load();
    });
  };
  const loadEvents = async (name = eventName, id = session, page = 1) => {
    const query = params();
    query.set('event', name);
    query.set('session', id);
    query.set('page', String(page));
    setDetails(await api<Details>('events?' + query));
    setEventName(name);
    setSession(id);
    setSection('events');
  };
  const download = async () => {
    const query = params();
    query.set('event', eventName);
    query.set('session', session);
    query.set('export', 'true');
    const data = await api<Details>('events?' + query);
    const escape = (value: unknown) => '"' + String(value ?? '').replace(/"/g, '""') + '"';
    const csv = [
      ['时间', '事件', '页面', '维度', '来源', '会话', '设备'],
      ...data.items.map((e) => [
        new Date(e.at).toISOString(),
        e.name,
        e.page,
        e.dimension,
        e.source,
        e.sessionId,
        e.device,
      ]),
    ]
      .map((row) => row.map(escape).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `gemigo-events-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setNotice(
      `已导出 ${data.items.length} 条${data.total > 5000 ? '（最多 5000 条，请缩小日期继续导出）' : ''}`
    );
  };
  if (checking) return <div className="loading">正在打开管理中心…</div>;
  if (!signedIn)
    return (
      <main className="login-page">
        <div className="login-story">
          <a className="brand" href="https://gemigo.io">
            <b>G</b> GemiGo <small>ADMIN</small>
          </a>
          <div>
            <span className="eyebrow">PRODUCT INSIGHTS</span>
            <h1>
              看见使用，
              <br />
              再做决定。
            </h1>
            <p>
              从一次访问到成功部署，
              <br />
              理解功能的真实使用情况。
            </p>
          </div>
          <small>独立管理系统 · 与主站账号分离</small>
        </div>
        <form className="login-card" onSubmit={login}>
          <span className="eyebrow">管理中心</span>
          <h2>欢迎回来</h2>
          <p className="muted">使用独立的管理员账号登录。</p>
          <label>
            管理员账号
            <input
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>
          <label>
            密码
            <input
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              maxLength={256}
            />
          </label>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? '正在登录…' : '进入管理中心 →'}
          </button>
          <small className="muted">主站登录状态不会授予管理权限。</small>
        </form>
      </main>
    );
  const nav = [
    ['overview', '◫', '使用概览'],
    ['features', '◈', '功能使用'],
    ['funnels', '⇢', '转化与路径'],
    ['events', '≡', '事件明细'],
    ['settings', '⚙', '采集与预算'],
  ];
  return (
    <div className="shell">
      <aside>
        <a className="brand" href="/">
          <b>G</b> GemiGo <small>ADMIN</small>
        </a>
        <span className="nav-label">产品分析</span>
        <nav>
          {nav.map(([key, icon, label]) => (
            <button
              key={key}
              className={section === key ? 'active' : ''}
              onClick={() => setSection(key)}
            >
              <span>{icon}</span>
              {label}
            </button>
          ))}
        </nav>
        <div className="aside-bottom">
          <span className="status-dot" /> 独立管理空间<p>按需查询 · 无自动轮询</p>
          <a href="https://gemigo.io" target="_blank" rel="noreferrer">
            打开主站 ↗
          </a>
        </div>
      </aside>
      <div className="workspace">
        <header>
          <span>GemiGo / 管理中心</span>
          <div>
            <span className="avatar">A</span>
            <strong>{username}</strong>
            <button
              onClick={() =>
                void run(async () => {
                  await api('logout', {});
                  setSignedIn(false);
                  setReport(null);
                  setDetails(null);
                })
              }
            >
              退出
            </button>
          </div>
        </header>
        <main>
          <div className="page-title">
            <div>
              <span className="eyebrow">PRODUCT ANALYTICS</span>
              <h1>{nav.find((n) => n[0] === section)?.[2]}</h1>
              <p className="muted">让真实行为帮助你决定下一步。</p>
            </div>
            <span className="pill">● 低请求采集</span>
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              {notice}
            </div>
          )}
          {section !== 'settings' && (
            <form
              className="filters"
              onSubmit={(e) => {
                e.preventDefault();
                void run(section === 'events' ? () => loadEvents() : load);
              }}
            >
              <label>
                开始日期（UTC）
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  required
                />
              </label>
              <label>
                结束日期（UTC）
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} required />
              </label>
              <label>
                设备
                <select value={device} onChange={(e) => setDevice(e.target.value)}>
                  <option value="all">全部设备</option>
                  <option value="desktop">电脑</option>
                  <option value="mobile">手机</option>
                  <option value="tablet">平板</option>
                </select>
              </label>
              <label>
                访客
                <select value={audience} onChange={(e) => setAudience(e.target.value)}>
                  <option value="all">全部访客</option>
                  <option value="signed_in">已登录</option>
                  <option value="anonymous">未登录</option>
                </select>
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={includeAdmin}
                  onChange={(e) => setIncludeAdmin(e.target.checked)}
                />
                含主站管理员
              </label>
              <button disabled={busy} className="primary">
                {busy ? '查询中…' : '应用筛选 / 刷新'}
              </button>
            </form>
          )}
          {section !== 'settings' && section !== 'events' && !report && (
            <article className="panel">
              <Empty text="点击“应用筛选 / 刷新”加载报表" />
            </article>
          )}
          {report && section !== 'settings' && section !== 'events' && (
            <p className="caption">
              当前报表：{applied} · 更新于 {time(report.generatedAt)} ·{' '}
              {report.cached ? '缓存结果' : '新生成'}（报表缓存 15 分钟）
            </p>
          )}
          {section === 'overview' && report && (
            <>
              <div className="metrics">
                {[
                  ['独立访客', report.summary.visitors, '匿名浏览器标识，非真实人数'],
                  ['访问会话', report.summary.sessions, '每个浏览器标签页为一个会话'],
                  ['页面浏览', report.summary.pageViews, '去除查询参数的页面访问'],
                  ['记录事件', report.summary.events, '采集范围内的操作与结果'],
                ].map(([label, value, hint]) => (
                  <article className="metric" key={label}>
                    <span>{label}</span>
                    <strong>{number(Number(value))}</strong>
                    <small>{hint}</small>
                  </article>
                ))}
              </div>
              <article className="panel">
                <div className="spread">
                  <h3>使用趋势</h3>
                  <span className="legend">● 每日事件</span>
                </div>
                <Trend report={report} />
              </article>
              <div className="two-columns">
                <article className="panel">
                  <h3>部署结果</h3>
                  <div className="result-grid">
                    <div>
                      <strong>{report.deployment.started}</strong>
                      <span>发起</span>
                    </div>
                    <div>
                      <strong>{report.deployment.succeeded}</strong>
                      <span>成功</span>
                    </div>
                    <div>
                      <strong>{report.deployment.failed}</strong>
                      <span>失败</span>
                    </div>
                  </div>
                  <p className="muted">
                    按部署流程去重；结果为浏览器观测。关闭页面或采集受限时，结果可能缺失，不能视为失败。
                  </p>
                </article>
                <article className="panel">
                  <h3>访问来源</h3>
                  {report.referrers.length ? (
                    report.referrers.map((r) => (
                      <div className="row" key={r.referrer}>
                        <span>{r.referrer}</span>
                        <strong>{r.sessions} 会话</strong>
                      </div>
                    ))
                  ) : (
                    <Empty />
                  )}
                </article>
              </div>
              <p className="footnote">
                统计不含历史回填。浏览器禁用追踪、拦截请求、队列丢弃及预算限额都会造成缺失；数据用于判断趋势，不作为精确账单。
              </p>
            </>
          )}
          {section === 'features' && report && (
            <>
              <article className="panel">
                <div className="spread">
                  <h3>功能使用排行</h3>
                  <span className="muted">含零记录功能</span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>功能</th>
                        <th>分组</th>
                        <th>事件数</th>
                        <th>访客数</th>
                        <th>确认来源</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.features.map((f) => (
                        <tr key={f.name}>
                          <td>
                            <button
                              className="text-button"
                              onClick={() => void run(() => loadEvents(f.name, ''))}
                            >
                              {f.label} ↗
                            </button>
                          </td>
                          <td>{f.category}</td>
                          <td>
                            <b>{number(f.events)}</b>
                            {!f.events && <small className="zero">未记录</small>}
                          </td>
                          <td>{number(f.visitors)}</td>
                          <td>
                            <span className="tag">
                              {f.source === 'server' ? '服务器' : '浏览器'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
              <article className="panel">
                <h3>功能细分</h3>
                {report.dimensions.length ? (
                  report.dimensions.map((r) => (
                    <div className="row" key={r.label}>
                      <span>{r.label}</span>
                      <strong>{r.events}</strong>
                    </div>
                  ))
                ) : (
                  <Empty />
                )}
              </article>
            </>
          )}
          {section === 'funnels' && report && (
            <>
              <div className="two-columns">
                <Funnel title="从创建到部署" steps={report.funnels.creation} />
                <Funnel title="从发现到使用" steps={report.funnels.discovery} />
              </div>
              <article className="panel">
                <h3>常见页面路径</h3>
                <p className="muted">同会话相邻页面之间的跳转；不包含参数或用户信息。</p>
                {report.paths.length ? (
                  report.paths.map((p) => (
                    <div className="row" key={p.path}>
                      <span>{p.path}</span>
                      <strong>{p.transitions} 次</strong>
                    </div>
                  ))
                ) : (
                  <Empty />
                )}
              </article>
            </>
          )}
          {section === 'events' && (
            <article className="panel">
              <div className="event-controls">
                <label>
                  事件
                  <select value={eventName} onChange={(e) => setEventName(e.target.value)}>
                    <option value="">全部事件</option>
                    {Object.entries(EVENTS).map(([name, [label]]) => (
                      <option key={name} value={name}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  匿名会话
                  <input
                    value={session}
                    placeholder="点击下方会话可追踪路径"
                    onChange={(e) => setSession(e.target.value)}
                  />
                </label>
                <button disabled={busy} onClick={() => void run(() => loadEvents())}>
                  查询明细
                </button>
                <button disabled={busy} onClick={() => void run(download)}>
                  导出 CSV ↓
                </button>
              </div>
              {details ? (
                <>
                  <p className="caption">
                    共 {number(details.total)} 条 · 按时间倒序 · 点击会话查看该会话事件
                  </p>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>时间</th>
                          <th>事件</th>
                          <th>页面 / 维度</th>
                          <th>会话</th>
                          <th>来源</th>
                        </tr>
                      </thead>
                      <tbody>
                        {details.items.map((e) => (
                          <tr key={e.id}>
                            <td className="nowrap">{time(e.at)}</td>
                            <td>{EVENTS[e.name]?.[0] || e.name}</td>
                            <td>
                              {e.page}
                              {e.dimension ? ` / ${e.dimension}` : ''}
                            </td>
                            <td>
                              <button
                                className="text-button"
                                title={e.sessionId}
                                onClick={() => void run(() => loadEvents('', e.sessionId))}
                              >
                                {e.sessionId.slice(0, 8)} ↗
                              </button>
                            </td>
                            <td>{e.source === 'server' ? '服务器' : '浏览器'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!details.items.length && <Empty />}
                  <div className="pagination">
                    <button
                      disabled={busy || details.page <= 1}
                      onClick={() =>
                        void run(() => loadEvents(eventName, session, details.page - 1))
                      }
                    >
                      上一页
                    </button>
                    <span>第 {details.page} 页</span>
                    <button
                      disabled={busy || details.page * details.limit >= details.total}
                      onClick={() =>
                        void run(() => loadEvents(eventName, session, details.page + 1))
                      }
                    >
                      下一页
                    </button>
                  </div>
                </>
              ) : (
                <Empty text="按需查询事件明细" />
              )}
            </article>
          )}
          {section === 'settings' && (
            <>
              <article className="panel">
                <div className="spread">
                  <h3>采集预算</h3>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const b = await api<Budget>('budget');
                        setBudget(b);
                        setEnabled(b.settings.enabled);
                        setDailyEvents(b.settings.dailyEvents);
                      })
                    }
                  >
                    读取当前配置
                  </button>
                </div>
                <p className="muted">
                  先随主站现有请求批量发送。无业务请求时，每浏览器每天最多补报 6 次，每次间隔至少 2
                  分钟。
                </p>
                {budget ? (
                  <>
                    <div className="budget-meter">
                      <div className="spread">
                        <span>今日已预留事件额度（UTC）</span>
                        <strong>
                          {number(budget.used.events || 0)} / {number(budget.settings.dailyEvents)}
                        </strong>
                      </div>
                      <div className="track">
                        <i
                          style={{
                            width: `${Math.min(100, ((budget.used.events || 0) / budget.settings.dailyEvents) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="result-grid">
                      <div>
                        <strong>{budget.used.piggyback || 0}</strong>
                        <span>捎带批次</span>
                      </div>
                      <div>
                        <strong>{budget.used.standalone || 0}</strong>
                        <span>独立补报批次</span>
                      </div>
                      <div>
                        <strong>{number(budget.used.reads || 0)}</strong>
                        <span>查询预留行额度 / 100 万</span>
                      </div>
                    </div>
                    <form
                      className="settings-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void run(async () => {
                          setBudget(await api<Budget>('settings', { enabled, dailyEvents }));
                          setNotice('采集配置已保存');
                        });
                      }}
                    >
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(e) => setEnabled(e.target.checked)}
                        />
                        开启采集存储
                      </label>
                      <label>
                        每天最多记录事件
                        <input
                          type="number"
                          min="100"
                          max="2000"
                          step="1"
                          required
                          value={dailyEvents}
                          onChange={(e) => setDailyEvents(Number(e.target.value))}
                        />
                      </label>
                      <button disabled={busy} className="primary">
                        保存配置
                      </button>
                    </form>
                  </>
                ) : (
                  <p className="muted">点击“读取当前配置”查看和管理预算。</p>
                )}
              </article>
              <article className="panel">
                <h3>数据口径与成本边界</h3>
                <ul className="notes">
                  <li>
                    原始数据保留 30 天；事件限额最高 2000 /
                    日。超限批次整批丢弃，额度包括重复或写入失败预留。
                  </li>
                  <li>
                    D1 的索引也消耗写入额度。这里展示的是本系统预算，不是 Cloudflare
                    账户的剩余额度。
                  </li>
                  <li>
                    报表缓存 15 分钟。查询前按日期范围预留保守的读取额度，上限每日 100
                    万行；达到上限仍可读取已有缓存。
                  </li>
                  <li>
                    浏览器不记录邮箱、表单、搜索词、代码、密钥、原始 URL 或
                    IP。匿名标识只用于会话和趋势分析。
                  </li>
                  <li>
                    关闭采集会停止事件写入；浏览器在下次已有请求收到配置后，也会停止补报。管理站不会后台轮询。
                  </li>
                </ul>
              </article>
            </>
          )}
        </main>
        <footer>
          GemiGo 管理中心 <span>数据帮助判断，不替代用户反馈。</span>
        </footer>
      </div>
    </div>
  );
}
