import { useEffect, useState } from 'react';
import Chart from './growth-chart';
import { number, percent, change, type GrowthReport } from './growth-report';
import { api } from './api';
import { deploymentChannelLabel } from './deployment-channels';

export default function Growth() {
  const [days, setDays] = useState(7);
  const [revision, setRevision] = useState(0);
  const [report, setReport] = useState<GrowthReport | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api<GrowthReport>(`growth?days=${days}`)
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
        'CLI部署尝试',
        '网页部署尝试',
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
        row.cliAttempts,
        row.webAttempts,
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
  const cli = report?.channels.find((row) => row.channel === 'cli');
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
            <span>
              CLI 尝试 <strong>{number(report.today.cliAttempts)}</strong>
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
            <Chart
              daily={report.daily}
              metric="cliAttempts"
              title="CLI 每日部署趋势"
              color="#c1843d"
              hint="CLI 与 Skill 统一统计；同一部署请求重试只记一次。成功、失败、进行中的已记录尝试均计入。"
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
          <article className="panel growth-channels">
            <h3>部署渠道与 CLI 使用</h3>
            <p className="muted">
              CLI / Skill 统一口径 · 所选完整 UTC 日 · 使用人数与应用数按期间、每个渠道分别去重。
            </p>
            <div className="metrics growth-metrics">
              <article className="metric">
                <span>CLI 部署尝试</span>
                <strong>{number(cli?.current.attempts)}</strong>
                <p>{change(cli?.current.attempts ?? 0, cli?.previous.attempts ?? 0)}</p>
                <small>
                  占全部尝试 {percent(cli?.current.attempts ?? 0, report.current.attempts ?? 0)}
                </small>
              </article>
              <article className="metric">
                <span>CLI 使用用户</span>
                <strong>{number(cli?.current.users)}</strong>
                <p>{number(cli?.current.projects)} 个应用</p>
                <small>尝试部署的登录账号去重</small>
              </article>
              <article className="metric">
                <span>CLI 成功部署</span>
                <strong>{number(cli?.current.succeeded)}</strong>
                <p>{number(cli?.current.failed)} 次失败 / 拒绝</p>
                <small>{number(cli?.current.pending)} 次进行中</small>
              </article>
              <article className="metric">
                <span>CLI 成功率</span>
                <strong>
                  {percent(
                    cli?.current.succeeded ?? 0,
                    (cli?.current.succeeded ?? 0) + (cli?.current.failed ?? 0)
                  )}
                </strong>
                <p>成功 ÷ 已结束尝试</p>
                <small>进行中不计为失败；无结束记录显示 —</small>
              </article>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {[
                      '渠道',
                      '部署尝试',
                      '尝试占比',
                      '成功',
                      '失败 / 拒绝',
                      '进行中',
                      '使用用户',
                      '应用',
                    ].map((label) => (
                      <th key={label}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.channels.map(({ channel, current }) => (
                    <tr key={channel}>
                      <td>{deploymentChannelLabel(channel)}</td>
                      <td>{number(current.attempts)}</td>
                      <td>{percent(current.attempts, report.current.attempts ?? 0)}</td>
                      {[
                        current.succeeded,
                        current.failed,
                        current.pending,
                        current.users,
                        current.projects,
                      ].map((value, i) => (
                        <td key={i}>{number(value)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="footnote">
              渠道来自部署客户端标记。旧版本未带标记时默认为网页，历史缺失无法补推；CLI
              表示上传入口，不能证明内容由 AI
              生成。应用管理可查每个应用首次与最近渠道，部署记录可按渠道筛选。跨渠道用户与应用可能重复，不能相加作为总数。
            </p>
          </article>
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
                      'CLI 尝试',
                      '网页尝试',
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
                        row.cliAttempts,
                        row.webAttempts,
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
