import { useEffect, useState } from 'react';
import type { AcquisitionReport } from '@gemigo/product-analytics';
import { api } from './api';
import './acquisition.css';

type Report = AcquisitionReport & { cached: boolean };
type Counts = Report['summary'][number];
const sourceName = (source: string) => (source === 'ai' ? 'AI 引荐' : '自然搜索');
const pageName: Record<string, string> = {
  home: '首页',
  explore: '探索页',
  guide: '发布指南',
  new_project: '发布入口',
  creator: '作者页',
  dashboard: '仪表板',
  project: '项目设置',
  profile: '个人主页',
  privacy: '隐私政策',
  other: '其他页面',
};
const number = (value: number) => value.toLocaleString('zh-CN');
const rate = (value: number | null) => (value === null ? '—' : (value * 100).toFixed(1) + '%');
const metrics = (row: Counts) => [
  ['观测访客', number(row.visitors), '期间按匿名浏览器去重'],
  ['入口会话', number(row.sessions), '同一标签页窗口中的首个页面'],
  [
    '新注册会话',
    row.eligibleSessions ? number(row.registeredSessions) : '—',
    `${number(row.eligibleSessions)} 个上线后入口会话中完成注册`,
  ],
  ['注册转化率', rate(row.conversionRate), '新注册会话 ÷ 上线后入口会话'],
  [
    '同会话成功发布',
    row.publishedSessions === null ? '—' : number(row.publishedSessions),
    '注册后发布，按服务端成功记录核验',
  ],
];
const csvCell = (value: unknown) => '"' + String(value ?? '').replace(/"/g, '""') + '"';
const acquisitionCsv = (report: Report) =>
  [
    [
      'UTC日期',
      '来源',
      '明细在留存范围内',
      '观测访客',
      '入口会话',
      '上线后可测会话',
      '新注册会话',
      '新账号数',
      '注册转化率',
      '同会话注册后成功发布',
      '范围',
    ],
    ...[
      ...report.daily.map((day) => ({ ...day, range: '完整日' })),
      { ...report.today, range: '今日未完成' },
    ].flatMap((day) =>
      day.sources.map((row) => [
        day.day,
        sourceName(row.source),
        day.available,
        ...(day.available
          ? [
              row.visitors,
              row.sessions,
              row.eligibleSessions,
              day.registrationsAvailable ? row.registeredSessions : null,
              day.registrationsAvailable ? row.registrations : null,
              row.conversionRate,
              row.publishedSessions,
            ]
          : [null, null, null, null, null, null, null]),
        day.range,
      ])
    ),
  ]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n');

export default function Acquisition() {
  const [days, setDays] = useState(7);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ report?: Report; error?: string; loading: boolean }>({
    loading: true,
  });
  useEffect(() => {
    let active = true;
    void api<Report>(`acquisition?days=${days}`).then(
      (report) => {
        if (active) setState({ report, loading: false });
      },
      (error: unknown) => {
        if (active)
          setState({ error: error instanceof Error ? error.message : '查询失败', loading: false });
      }
    );
    return () => {
      active = false;
    };
  }, [days, revision]);
  const reload = (nextDays: number) => {
    setState({ loading: true });
    setDays(nextDays);
    setRevision((value) => value + 1);
  };
  const report = state.report;
  const download = () => {
    if (!report) return;
    const url = URL.createObjectURL(
      new Blob(['\ufeff' + acquisitionCsv(report)], { type: 'text/csv;charset=utf-8' })
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `gemigo-search-ai-${report.period.from}-${report.period.to}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="acquisition">
      <div className="spread">
        <div className="filters">
          <button aria-pressed={days === 7} onClick={() => reload(7)} disabled={state.loading}>
            近 7 个完整日
          </button>
          <button aria-pressed={days === 30} onClick={() => reload(30)} disabled={state.loading}>
            近 30 个完整日
          </button>
          <button onClick={() => reload(days)} disabled={state.loading}>
            刷新
          </button>
        </div>
        <button onClick={download} disabled={!report || state.loading}>
          导出每日 CSV
        </button>
      </div>
      {state.loading && <p role="status">正在加载搜索与 AI 获客…</p>}
      {state.error && (
        <div className="error" role="alert">
          {state.error}
          <button onClick={() => reload(days)}>重试</button>
        </div>
      )}
      {report && (
        <>
          <p className="caption">
            {report.period.from} — {report.period.to}（UTC） ·{' '}
            {report.cached ? '缓存结果' : '新生成'} ·{' '}
            {new Date(report.generatedAt).toLocaleString('zh-CN')} · 缓存 15 分钟
          </p>
          {report.period.partial && (
            <p className="notice">
              部分日期超过 30 天滚动明细留存，指标只覆盖 {report.period.availableFrom}{' '}
              起的完整日；缺失日期显示“—”。
            </p>
          )}
          <p className="muted">
            {report.registrationTrackingSince
              ? `注册口径自 ${new Date(report.registrationTrackingSince).toLocaleString('zh-CN', { timeZone: 'UTC' })} UTC 起生效`
              : '注册口径尚未启用'}
            ，包含邮箱、Google 和 GitHub
            新账号；重登和已有账号加密码不算注册。转化率只使用上线后入口会话，旧注册事件不混入。
          </p>
          <p className="muted">
            成功发布仅覆盖同一观测会话中注册后发起、并在统计截止前由服务端确认成功的发布；不覆盖跨会话或跨设备归因，不以浏览器提示代替成功记录。
          </p>
          {report.summary.map((row) => (
            <section key={row.source} className="acquisition-source">
              <h2>{sourceName(row.source)}</h2>
              <div className="metrics">
                {metrics(row).map(([label, value, hint]) => (
                  <article className="metric" key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                    <small>{hint}</small>
                  </article>
                ))}
              </div>
              <p className="caption">
                观测新账号：{number(row.registrations)}；同一会话多次新建账号只形成一个转化会话。
              </p>
            </section>
          ))}
          {report.summary.every((row) => !row.sessions) && (
            <article className="panel">
              <p>这段时间没有采集到搜索或 AI 入口会话。</p>
              <p className="muted">
                缺少来源、Do Not Track、采集预算和拦截器会影响覆盖，不能推断没有真实访问。
              </p>
            </article>
          )}
          <article className="panel">
            <h2>每日入口趋势</h2>
            <p className="muted">
              每日按入口日期归组，结果观察截至本次查询；完整日汇总截至今日 UTC
              零点，转化结果不可直接将每日数据相加。
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>UTC 日期</th>
                    <th>自然搜索会话</th>
                    <th>AI 引荐会话</th>
                    <th>新注册会话</th>
                  </tr>
                </thead>
                <tbody>
                  {report.daily.map((day) => (
                    <tr key={day.day}>
                      <td>{day.day}</td>
                      <td>{day.available ? number(day.sources[0].sessions) : '—'}</td>
                      <td>{day.available ? number(day.sources[1].sessions) : '—'}</td>
                      <td>
                        {day.available && day.registrationsAvailable
                          ? number(
                              day.sources.reduce((sum, row) => sum + row.registeredSessions, 0)
                            )
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
          <article className="panel">
            <h2>今日（UTC，未完成）</h2>
            <p className="muted">
              {report.today.day}；不并入上面的完整日统计。入口指本次查询窗口中首次出现的会话。
            </p>
            <div className="acquisition-today">
              {report.today.sources.map((row) => (
                <div key={row.source}>
                  <strong>{sourceName(row.source)}</strong>
                  <p>
                    {number(row.sessions)} 个入口会话 ·{' '}
                    {report.today.registrationsAvailable ? number(row.registeredSessions) : '—'}{' '}
                    个新注册会话 · {rate(row.conversionRate)} 转化率
                  </p>
                </div>
              ))}
            </div>
          </article>
          <article className="panel">
            <h2>从哪些页面进入？</h2>
            <p className="muted">
              首个观测页面按类别归组，不存原始网址或查询词；分组访客不可相加为全站 UV。
            </p>
            {report.landings.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>页面类别</th>
                      <th>来源</th>
                      <th>观测访客</th>
                      <th>入口会话</th>
                      <th>新注册会话</th>
                      <th>转化率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.landings.map((row) => (
                      <tr key={row.page + row.source}>
                        <td>{pageName[row.page] || '其他页面'}</td>
                        <td>{sourceName(row.source)}</td>
                        <td>{number(row.visitors)}</td>
                        <td>{number(row.sessions)}</td>
                        <td>{number(row.registeredSessions)}</td>
                        <td>{rate(row.conversionRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">暂无入口数据</p>
            )}
          </article>
          <article className="panel">
            <div className="spread">
              <h2>Google 搜索表现</h2>
              <span className="pill">Search Console 未连接到后台</span>
            </div>
            <div className="metrics">
              {['展示次数', '搜索点击', 'CTR', '平均排名'].map((label) => (
                <article className="metric" key={label}>
                  <span>{label}</span>
                  <strong>—</strong>
                  <small>需要 Search Console 数据</small>
                </article>
              ))}
            </div>
            <p>
              <a
                href="https://search.google.com/search-console?resource_id=sc-domain%3Agemigo.io"
                target="_blank"
                rel="noreferrer"
              >
                打开 Search Console ↗
              </a>{' '}
              ·{' '}
              <a href="https://gemigo.io/sitemap.xml" target="_blank" rel="noreferrer">
                查看 sitemap ↗
              </a>
            </p>
          </article>
          <article className="panel">
            <h2>如何判断 SEO / GEO 的效果？</h2>
            <p>
              优先观察搜索和 AI 来源是否带来更多入口会话与新注册，结合 Search Console 的展示、点击和
              CTR 复盘公开页面。观察窗口建议按完整 UTC 周比较。
            </p>
            <p className="muted">
              这里记录的是有来源信息的引荐流量，并非全部自然流量、真人数量或 AI 引用次数。Google AI
              概览与 AI Mode 的访问仍归 Google 搜索，不能单独拆分。付费 UTM
              渠道被排除；缺失来源会归直接访问。匿名会话与事件受预算、DNT 和 30 天明细留存限制。
            </p>
          </article>
        </>
      )}
    </div>
  );
}
