import { useEffect, useRef, useState } from 'react';
import { api } from './api';

type Daily = {
  day: string;
  pv: number | null;
  visits: number | null;
  appsPv: number | null;
  uv: number | null;
  registrations: number;
  projects: number;
  attempts: number;
  succeeded: number;
};
type Report = {
  period: {
    days: number;
    from: string;
    to: string;
    previousFrom: string;
    previousTo: string;
    today: string;
    rawFrom: string;
  };
  daily: Daily[];
  today: Daily;
  current: Record<string, number | null>;
  previous: Record<string, number | null>;
  observedUv: number;
  uvPartial: boolean;
  cohort: { registered: number; activated: number; deployed: number };
  referrers: { count: number; sum: { visits: number }; dimensions: { refererHost: string } }[];
  devices: { count: number; sum: { visits: number }; dimensions: { deviceType: string } }[];
  web: {
    fetchedAt: number | null;
    stale: boolean;
    error: string | null;
    adaptiveSampling: boolean;
  };
  generatedAt: number;
  cached: boolean;
};
const number = (value: number | null | undefined) =>
  value == null ? '—' : Math.round(value).toLocaleString('zh-CN');
const percent = (n: number, denominator: number) =>
  denominator ? `${((n / denominator) * 100).toFixed(1)}%` : '—';
const change = (current: number | null, previous: number | null) =>
  current == null || previous == null
    ? '缺少可比较数据'
    : previous === 0
      ? current === 0
        ? '两个周期均为 0'
        : '上期为 0，新增 ' + number(current)
      : `${current >= previous ? '↑' : '↓'} ${Math.abs(((current - previous) / previous) * 100).toFixed(1)}% 较上一等长周期`;
function Chart({
  daily,
  metric,
  title,
  color,
  hint,
}: {
  daily: Daily[];
  metric: 'pv' | 'uv' | 'registrations';
  title: string;
  color: string;
  hint: string;
}) {
  const plot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (plot.current) plot.current.scrollLeft = plot.current.scrollWidth;
  }, [daily]);
  const values = daily.map((row) => row[metric]);
  const max = Math.max(2, ...values.filter((v): v is number => v !== null));
  const x = (i: number) => 45 + (i / Math.max(1, daily.length - 1)) * 600;
  const y = (n: number) => 165 - (n / max) * 125;
  const segments: string[] = [];
  let segment = '';
  values.forEach((value, i) => {
    if (value === null) {
      if (segment) segments.push(segment);
      segment = '';
    } else segment += `${segment ? ' L' : 'M'}${x(i)},${y(value)}`;
  });
  if (segment) segments.push(segment);
  return (
    <article className="panel growth-chart">
      <div className="spread">
        <h3>{title}</h3>
        <span className="tag">按日</span>
      </div>
      <div ref={plot} className="growth-plot" tabIndex={0} aria-label={`${title}图表，可横向滚动`}>
        <svg viewBox="0 0 680 210" role="img" aria-label={title}>
          <title>{title}；完整数值见每日数据表</title>
          {[0, 0.5, 1].map((scale) => (
            <g key={scale}>
              <line
                x1="45"
                y1={y(max * scale)}
                x2="645"
                y2={y(max * scale)}
                stroke="#e9e8f0"
                strokeDasharray="4 5"
              />
              <text x="35" y={y(max * scale) + 4} textAnchor="end" fill="#9297a8" fontSize="11">
                {number(max * scale)}
              </text>
            </g>
          ))}
          {segments.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {daily.map((row, i) => (
            <g key={row.day}>
              {row[metric] !== null && (
                <circle cx={x(i)} cy={y(row[metric]!)} r="3.5" fill={color}>
                  <title>
                    {row.day}：{number(row[metric])}
                  </title>
                </circle>
              )}
              {(daily.length <= 7 || i % 5 === 0 || i === daily.length - 1) && (
                <text x={x(i)} y="194" textAnchor="middle" fill="#9297a8" fontSize="11">
                  {row.day.slice(5)}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
      <p className="footnote">{hint}</p>
    </article>
  );
}
export default function Growth() {
  const [days, setDays] = useState(7);
  const [revision, setRevision] = useState(0);
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api<Report>(`growth?days=${days}`)
      .then((data) => {
        if (active) setReport(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : '增长数据加载失败');
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [days, revision]);
  const load = (value = days) => {
    setBusy(true);
    setError('');
    setDays(value);
    setRevision((n) => n + 1);
  };
  const download = () => {
    if (!report) return;
    const csv = [
      [
        'UTC日期',
        '官网真人PV',
        '官网访问次数',
        '产品观测UV',
        '新增注册',
        '新增有效应用',
        '部署尝试',
        '成功部署',
        '应用真人PV',
      ],
      ...report.daily.map((row) => [
        row.day,
        row.pv,
        row.visits,
        row.uv,
        row.registrations,
        row.projects,
        row.attempts,
        row.succeeded,
        row.appsPv,
      ]),
    ]
      .map((row) => row.map((v) => (v == null ? '' : String(v))).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `gemigo-growth-${report.period.from}-${report.period.to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="growth-console">
      <div className="spread growth-toolbar">
        <div className="button-row">
          {[7, 30].map((value) => (
            <button
              key={value}
              className={value === days ? 'active-range' : ''}
              disabled={busy}
              onClick={() => load(value)}
            >
              近 {value} 天
            </button>
          ))}
        </div>
        <button disabled={busy} onClick={() => load()}>
          刷新大盘
        </button>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
          <button onClick={() => load()}>重试</button>
        </div>
      )}
      {busy && (
        <p className="muted" role="status">
          正在汇总流量和业务增长…
        </p>
      )}
      {report && (
        <>
          <p className="caption">
            {report.period.from} — {report.period.to} · 完整 UTC 日 · 对比{' '}
            {report.period.previousFrom} — {report.period.previousTo} ·{' '}
            {report.cached ? '5 分钟内缓存' : '本次查询'} · 更新于{' '}
            {new Date(report.generatedAt).toLocaleString('zh-CN', { hour12: false })}
          </p>
          {report.web.error && (
            <div className="notice" role="status">
              {report.web.error}
              {report.web.fetchedAt
                ? ` 上次成功：${new Date(report.web.fetchedAt).toLocaleString('zh-CN')}`
                : ''}
            </div>
          )}
          <div className="metrics growth-metrics">
            {[
              {
                label: '官网真人 PV',
                value: report.current.pv,
                hint: change(report.current.pv, report.previous.pv),
                foot: `访问次数 ${number(report.current.visits)} · Cloudflare RUM`,
              },
              {
                label: '产品观测 UV',
                value: report.observedUv,
                hint: report.uvPartial ? '部分日期明细已过留存期' : '所选期间按浏览器标识去重',
                foot: '已采集页面访客，不等于自然人数',
              },
              {
                label: '新增注册',
                value: report.current.registrations,
                hint: change(report.current.registrations, report.previous.registrations),
                foot: '全部登录方式 · 业务数据库',
              },
              {
                label: '成功部署',
                value: report.current.succeeded,
                hint: change(report.current.succeeded, report.previous.succeeded),
                foot: `${number(report.current.attempts)} 次尝试 · 成功率 ${percent(report.current.succeeded || 0, report.current.attempts || 0)}`,
              },
            ].map((item) => (
              <article className="metric" key={item.label}>
                <span>{item.label}</span>
                <strong>{number(item.value)}</strong>
                <p>{item.hint}</p>
                <small>{item.foot}</small>
              </article>
            ))}
          </div>
          <div className="growth-live">
            <span className="pill">今日 UTC · 进行中</span>
            <span>
              PV <strong>{number(report.today.pv)}</strong>
            </span>
            <span>
              观测 UV <strong>{number(report.today.uv)}</strong>
            </span>
            <span>
              注册 <strong>{number(report.today.registrations)}</strong>
            </span>
            <span>
              成功部署 <strong>{number(report.today.succeeded)}</strong>
            </span>
            <small>未完成日不参与上方环比</small>
          </div>
          <div className="growth-grid">
            <Chart
              daily={report.daily}
              metric="pv"
              title="官网 PV 增长曲线"
              color="#7c4fce"
              hint="官网真人页面浏览 · Cloudflare Web Analytics · 排除 bot=1；自适应采样。"
            />
            <Chart
              daily={report.daily}
              metric="uv"
              title="产品观测 UV 增长曲线"
              color="#27927e"
              hint="每天按浏览器标识去重；受采集预算、DNT 和拦截影响。缺失留存日断线显示，每日 UV 不相加作为期间 UV。"
            />
            <Chart
              daily={report.daily}
              metric="registrations"
              title="每日新增注册"
              color="#557bc5"
              hint="所有登录方式的新账号，按 users.created_at；不混入重复登录。手机可左右滑动图表查看日期。"
            />
            <article className="panel growth-cohort">
              <h3>新用户激活</h3>
              <p className="muted">所选期间注册的同一批用户，截至期间结束的结果。</p>
              {[
                ['注册账号', report.cohort.registered],
                ['创建过有效应用', report.cohort.activated],
                ['成功部署过应用', report.cohort.deployed],
              ].map(([label, value], index) => (
                <div className="growth-step" key={String(label)}>
                  <div className="spread">
                    <span>
                      {index + 1}. {label}
                    </span>
                    <strong>{number(Number(value))}</strong>
                  </div>
                  <div className="track">
                    <i
                      style={{
                        width: `${report.cohort.registered ? (Number(value) / report.cohort.registered) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <small className="muted">
                    {percent(Number(value), report.cohort.registered)} 的新注册用户
                  </small>
                </div>
              ))}
              <p className="footnote">
                这是注册用户队列的激活结果，流量和注册来自不同数据源，不能视为同一批访客的个人转化。样本少于
                30 人时谨慎判断。
              </p>
            </article>
            <article className="panel">
              <h3>官网获客来源</h3>
              <p className="muted">按来源主机统计访问次数，前 20 项。</p>
              <div className="growth-breakdown">
                {report.referrers.map((row) => (
                  <div className="spread" key={row.dimensions.refererHost || 'direct'}>
                    <span>{row.dimensions.refererHost || '直接访问 / 无来源'}</span>
                    <strong>{number(row.sum.visits)}</strong>
                  </div>
                ))}
              </div>
              {!report.referrers.length && <p className="muted">当前没有可用的来源数据。</p>}
            </article>
            <article className="panel">
              <h3>官网设备分布</h3>
              <div className="growth-breakdown">
                {report.devices.map((row) => (
                  <div className="spread" key={row.dimensions.deviceType}>
                    <span>
                      {{ desktop: '电脑', mobile: '手机', tablet: '平板' }[
                        row.dimensions.deviceType
                      ] ||
                        row.dimensions.deviceType ||
                        '未知'}
                    </span>
                    <strong>{number(row.count)} PV</strong>
                  </div>
                ))}
              </div>
              <p className="footnote">
                应用网站真人 PV：{number(report.current.appsPv)}
                ，与官网流量分开统计。可以结合设备差异检查手机端转化体验。
              </p>
            </article>
          </div>
          <article className="panel">
            <div className="spread">
              <h3>每日数据</h3>
              <button disabled={busy} onClick={download}>
                导出每日 CSV
              </button>
            </div>
            <p className="muted">UTC 日期；“—”代表缺少可用数据。表格可横向滚动。</p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {[
                      '日期',
                      '官网 PV',
                      '访问次数',
                      '观测 UV',
                      '新增注册',
                      '新增应用',
                      '部署尝试',
                      '成功部署',
                      '应用 PV',
                    ].map((label) => (
                      <th key={label}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...report.daily].reverse().map((row) => (
                    <tr key={row.day}>
                      <td>{row.day}</td>
                      {[
                        row.pv,
                        row.visits,
                        row.uv,
                        row.registrations,
                        row.projects,
                        row.attempts,
                        row.succeeded,
                        row.appsPv,
                      ].map((value, i) => (
                        <td key={i}>{number(value)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
          <p className="footnote">
            真人流量缓存 30 分钟，整份大盘缓存 5 分钟；不会自动轮询。UV 明细保留 30
            天，采集停止或预算用尽会影响覆盖。访问次数由 Cloudflare 的外部或直接进入页面定义，与 UV
            分别统计。
            {report.web.fetchedAt
              ? ` 流量采集查询于 ${new Date(report.web.fetchedAt).toLocaleString('zh-CN')}。`
              : ''}
          </p>
        </>
      )}
    </div>
  );
}
