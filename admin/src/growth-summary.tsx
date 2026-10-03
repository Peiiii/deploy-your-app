import { useEffect, useState } from 'react';
import { api } from './api';
import Chart from './growth-chart';
import { change, number, percent, type GrowthReport } from './growth-report';
import type { Navigate } from './navigation';

const activationChange = (report: GrowthReport) => {
  const current = report.cohort;
  const previous = report.previousCohort;
  if (!current.registered || !previous.registered) return '缺少可比较的注册样本';
  const difference =
    (current.deployed / current.registered - previous.deployed / previous.registered) * 100;
  return `${difference >= 0 ? '↑' : '↓'} ${Math.abs(difference).toFixed(1)} 个百分点较上期`;
};

export default function GrowthSummary({
  days,
  revision,
  navigate,
}: {
  days: number;
  revision: number;
  navigate: Navigate;
}) {
  const [snapshot, setSnapshot] = useState<GrowthReport | null>(null);
  const [settled, setSettled] = useState({ key: '', error: '' });
  const [retry, setRetry] = useState(0);
  const [traffic, setTraffic] = useState<'appsPv' | 'pv' | 'uv'>('appsPv');
  const requestKey = `${days}:${revision}:${retry}`;
  const pending = settled.key !== requestKey;
  const error = pending ? '' : settled.error;
  useEffect(() => {
    let active = true;
    api<GrowthReport>(`growth?days=${days}`)
      .then((data) => {
        if (active) {
          setSnapshot(data);
          setSettled({ key: requestKey, error: '' });
        }
      })
      .catch((err) => {
        if (active)
          setSettled({
            key: requestKey,
            error: err instanceof Error ? err.message : '增长摘要加载失败',
          });
      });
    return () => {
      active = false;
    };
  }, [days, requestKey]);
  // Never label an earlier range as the newly selected period.
  const report = snapshot?.period.days === days ? snapshot : null;
  const reload = () => setRetry((value) => value + 1);
  const titles = { appsPv: '应用真人 PV 趋势', pv: '官网真人 PV 趋势', uv: '官网产品观测 UV 趋势' };
  const hints = {
    appsPv: '应用网站真人页面浏览 · Cloudflare RUM · bot=0 · 自适应采样。',
    pv: '官网真人页面浏览，与应用网站分开统计 · Cloudflare RUM · bot=0。',
    uv: '官网已采集页面按浏览器标识每日去重，受采集覆盖和留存期影响；不等于应用 UV 或自然人数。',
  };
  const cli = report?.channels.find((row) => row.channel === 'cli')?.current;
  const ended =
    report?.channels.reduce(
      (total, row) => total + row.current.succeeded + row.current.failed,
      0
    ) ?? 0;
  return (
    <section className="home-growth" aria-label="经营增长摘要">
      {error && (
        <div className="error" role="alert">
          {error}{' '}
          {report
            ? '显示上次成功的增长摘要，请留意更新时间。'
            : '增长摘要暂不可用，下方业务与待办仍可查看。'}
          <button onClick={reload} disabled={pending}>
            重试增长摘要
          </button>
        </div>
      )}
      {!report && !error && (
        <article className="panel loading-panel" role="status">
          正在读取完整周期的增长摘要…
        </article>
      )}
      {pending && report && (
        <p className="muted" role="status">
          正在更新增长摘要，上次数据仍可查看…
        </p>
      )}
      {report && (
        <>
          <div className="spread operating-report-note">
            <p className="caption">
              {report.period.from} — {report.period.to} · 完整 UTC 日 · 对比{' '}
              {report.period.previousFrom} — {report.period.previousTo}
            </p>
            <button onClick={() => navigate('growth')}>查看完整增长大盘 ↗</button>
          </div>
          {report.web.error && (
            <div className="notice" role="status">
              {report.web.error}{' '}
              {report.web.fetchedAt
                ? `流量上次成功：${new Date(report.web.fetchedAt).toLocaleString('zh-CN')}`
                : ''}
            </div>
          )}
          <div className="metrics business-metrics home-primary-metrics">
            {[
              {
                title: '成功发布创作者',
                value: number(report.publishing.current.publishers),
                comparison: change(
                  report.publishing.current.publishers,
                  report.publishing.previous.publishers
                ),
                hint: '本期至少成功一次，按账号去重',
              },
              {
                title: '新增注册',
                value: number(report.current.registrations),
                comparison: change(report.current.registrations, report.previous.registrations),
                hint: '全部登录方式的新账号',
              },
              {
                title: '新用户发布激活率',
                value: percent(report.cohort.deployed, report.cohort.registered),
                comparison: activationChange(report),
                hint: `${number(report.cohort.deployed)} / ${number(report.cohort.registered)} 位本期注册用户成功发布`,
              },
              {
                title: '应用真人 PV',
                value: number(report.current.appsPv),
                comparison: change(report.current.appsPv, report.previous.appsPv),
                hint: 'Cloudflare RUM · 自适应采样',
              },
            ].map((item) => (
              <article className="metric" key={item.title}>
                <span>{item.title}</span>
                <strong>{item.value}</strong>
                <p>{item.comparison}</p>
                <small>{item.hint}</small>
              </article>
            ))}
          </div>
          <div className="growth-live">
            <span className="pill">今日 UTC · 进行中</span>
            <span>
              发布创作者 <strong>{number(report.today.publishers)}</strong>
            </span>
            <span>
              注册 <strong>{number(report.today.registrations)}</strong>
            </span>
            <span>
              应用 PV <strong>{number(report.today.appsPv)}</strong>
            </span>
            <small>未完成日不参与上方比较</small>
          </div>
          <div className="growth-grid home-trends">
            <Chart
              daily={report.daily}
              metric="publishers"
              title="每日成功发布创作者"
              color="#7c4fce"
              hint="每天按成功发布账号去重；同一人跨日可重复，每日人数不能相加作为期间人数。"
            />
            <div className="home-traffic">
              <div className="button-row home-traffic-tabs" aria-label="选择访问趋势">
                {(['appsPv', 'pv', 'uv'] as const).map((metric) => (
                  <button
                    key={metric}
                    className={traffic === metric ? 'active-range' : ''}
                    aria-pressed={traffic === metric}
                    onClick={() => setTraffic(metric)}
                  >
                    {{ appsPv: '应用 PV', pv: '官网 PV', uv: '官网观测 UV' }[metric]}
                  </button>
                ))}
              </div>
              <Chart
                daily={report.daily}
                metric={traffic}
                title={titles[traffic]}
                color="#27927e"
                hint={hints[traffic]}
              />
            </div>
          </div>
          <div className="two-columns home-analysis">
            <article className="panel growth-cohort">
              <div className="spread">
                <h3>新用户激活</h3>
                <span className="tag">同一批注册用户</span>
              </div>
              {[
                ['注册账号', report.cohort.registered],
                ['创建有效应用', report.cohort.activated],
                ['成功发布应用', report.cohort.deployed],
              ].map(([label, value]) => (
                <div className="growth-step" key={String(label)}>
                  <div className="spread">
                    <span>{label}</span>
                    <strong>
                      {number(Number(value))}{' '}
                      <small>· {percent(Number(value), report.cohort.registered)}</small>
                    </strong>
                  </div>
                  <div className="track">
                    <i
                      style={{
                        width: `${report.cohort.registered ? (Number(value) / report.cohort.registered) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
              <p className="footnote">
                截至各自周期结束的结果，非固定天数留存。
                {report.cohort.registered < 30
                  ? '本期不足 30 位注册用户，谨慎判断。'
                  : '流量与注册来自不同人群，不能拼成个人转化漏斗。'}
              </p>
            </article>
            <article className="panel">
              <h3>创作者复用与 CLI 贡献</h3>
              <div className="result-grid">
                <div>
                  <strong>{number(report.publishing.current.firstPublishers)}</strong>
                  <span>首次发布创作者</span>
                </div>
                <div>
                  <strong>{number(report.publishing.current.repeatPublishers)}</strong>
                  <span>再次发布创作者</span>
                </div>
                <div>
                  <strong>{percent(report.current.succeeded ?? 0, ended)}</strong>
                  <span>已结束尝试成功率</span>
                </div>
              </div>
              <div className="row">
                <span>CLI 成功发布创作者</span>
                <strong>{number(cli?.successfulUsers)}</strong>
              </div>
              <div className="row">
                <span>CLI 成功部署贡献</span>
                <strong>
                  {number(cli?.succeeded)} 次 ·{' '}
                  {percent(cli?.succeeded ?? 0, report.current.succeeded ?? 0)}
                </strong>
              </div>
              <div className="row">
                <span>CLI 已结束尝试成功率</span>
                <strong>
                  {percent(cli?.succeeded ?? 0, (cli?.succeeded ?? 0) + (cli?.failed ?? 0))}
                </strong>
              </div>
              <p className="footnote">
                首次/再次只覆盖已记录的成功历史，不等于留存率。CLI 与 Skill 合并统计，入口不证明 AI
                生成；进行中不计入成功率。
              </p>
              <button onClick={() => navigate('growth')}>查看渠道与每日明细 →</button>
            </article>
          </div>
          <p className="caption">
            增长摘要更新于 {new Date(report.generatedAt).toLocaleString('zh-CN')} ·{' '}
            {report.cached ? '5 分钟内缓存' : '本次查询'}；流量缓存最多 30 分钟。
            {report.web.stale ? '流量为上次成功数据。' : ''}
          </p>
        </>
      )}
    </section>
  );
}
