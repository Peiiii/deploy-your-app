import GrowthSummary from './growth-summary';
import TimeSeriesChart from './time-series-chart';
import type { Navigate } from './navigation';

type Row = Record<string, string | number | null>;
type Queue = { items: Row[]; total: number; page: number; limit: number };
export type Overview = {
  days: number;
  from: string;
  generatedAt: number;
  summary: Row;
  deployments: Row;
  daily: Row[];
  sources: Row[];
  errors: Row[];
  traffic: Row;
  publishing: Row;
  attention: Queue;
  feedback: Queue;
};
const count = (value: unknown) => Number(value || 0).toLocaleString('zh-CN');
const queuePage = (queue: Queue, busy: boolean, change: (page: number) => void) => (
  <div className="pagination">
    <span>
      共 {count(queue.total)} 条 · 第 {queue.page} 页
    </span>
    <button disabled={busy || queue.page <= 1} onClick={() => change(queue.page - 1)}>
      上一页
    </button>
    <button
      disabled={busy || queue.page * queue.limit >= queue.total}
      onClick={() => change(queue.page + 1)}
    >
      下一页
    </button>
  </div>
);
export default function OperatingSummary({
  report,
  navigate,
  busy,
  changePage,
  revision,
  days,
}: {
  report: Overview;
  revision: number;
  days: number;
  navigate: Navigate;
  busy: boolean;
  changePage: (queue: 'attention' | 'feedback', page: number) => void;
}) {
  return (
    <>
      <GrowthSummary days={days} revision={revision} navigate={navigate} />
      <div className="metrics operating-totals">
        {[
          [
            '累计用户',
            report.summary.users,
            `近 ${report.days} 天含今日新增 ${count(report.summary.newUsers)}`,
          ],
          [
            '有效应用',
            report.summary.projects,
            `上线 ${count(report.summary.live)} · 公开上线 ${count(report.summary.public)}`,
          ],
        ].map(([title, value, hint]) => (
          <article className="metric" key={String(title)}>
            <span>{title}</span>
            <strong>{count(value)}</strong>
            <small>{hint}</small>
          </article>
        ))}
      </div>
      <details className="panel home-diagnostics">
        <summary>部署诊断与已采集流量 · 近 {report.days} 天含今日 UTC</summary>
        <div className="two-columns dashboard-columns">
          <article className="panel">
            <div className="spread">
              <h3>每日部署趋势</h3>
              <span className="legend">紫色：全部 · 绿色：成功</span>
            </div>
            <TimeSeriesChart
              title="每日部署趋势"
              kind="bar"
              data={report.daily.map((row) => ({
                day: String(row.day),
                values: { total: Number(row.total), succeeded: Number(row.succeeded) },
              }))}
              series={[
                { key: 'total', label: '全部尝试', color: '#7c4fce', unit: '次' },
                { key: 'succeeded', label: '成功尝试', color: '#27927e', unit: '次' },
              ]}
            />
            <p className="footnote">
              按尝试开始日统计，未结束尝试单独计为处理中。30 天图表可左右滚动。
            </p>
          </article>
          <article className="panel">
            <h3>部署概况与诊断</h3>
            <div className="result-grid">
              <div>
                <strong>{count(report.deployments.total)}</strong>
                <span>本期尝试</span>
              </div>
              <div>
                <strong>{count(report.deployments.pending)}</strong>
                <span>处理中</span>
              </div>
              <div>
                <strong>{count(report.deployments.failed)}</strong>
                <span>失败 / 拒绝</span>
              </div>
            </div>
            <button onClick={() => navigate('deployments')}>查看部署记录 →</button>
            <details className="operating-diagnostics">
              <summary>来源与失败原因</summary>
              <h3>部署来源</h3>
              {report.sources.map((row) => (
                <div className="row" key={String(row.name)}>
                  <span>{row.name || '未记录来源'}</span>
                  <strong>{count(row.total)} 次</strong>
                </div>
              ))}
              <h3>失败原因</h3>
              {report.errors.map((row) => (
                <div className="row" key={String(row.name)}>
                  <code>{row.name || '未记录错误代码'}</code>
                  <strong>{count(row.total)} 次</strong>
                </div>
              ))}
              {!report.errors.length && <p className="muted">本期没有失败记录</p>}
            </details>
          </article>
        </div>
        <p className="caption">
          诊断独立窗口：{report.from} 至今日 UTC。D1 已采集应用访问{' '}
          {count(report.traffic.humanViews)}，机器人 {count(report.traffic.botViews)}；不替代上方
          Cloudflare 真人 PV。
        </p>
      </details>
      <div className="two-columns action-columns">
        <article className="panel action-panel">
          <div className="spread">
            <h3>
              待关注应用 <span className="queue-count">{count(report.attention.total)}</span>
            </h3>
            <button onClick={() => navigate('projects')}>应用管理</button>
          </div>
          <p className="muted">当前失败，或部署中超过 24 小时；应用原链接可能仍可访问。</p>
          {report.attention.items.map((row) => (
            <button
              className="action-item"
              key={String(row.id)}
              onClick={() => navigate('projects', String(row.id))}
            >
              <div>
                <b>{row.name || row.id}</b>
                <small>
                  {row.reason === 'stalled' ? '部署超过 24 小时' : '当前状态：失败'} ·{' '}
                  {row.error_code || '未记录错误代码'}
                </small>
              </div>
              <span>查看详情 →</span>
            </button>
          ))}
          {!report.attention.items.length && (
            <div className="empty">
              <p>{report.attention.total ? '本页没有记录，请返回上一页' : '当前没有待关注应用'}</p>
            </div>
          )}
          {queuePage(report.attention, busy, (page) => changePage('attention', page))}
        </article>
        <article className="panel action-panel">
          <div className="spread">
            <h3>
              待处理反馈 <span className="queue-count">{count(report.feedback.total)}</span>
            </h3>
            <button onClick={() => navigate('feedback')}>反馈管理</button>
          </div>
          <p className="muted">优先展示最早提交、尚未处理的私密反馈。</p>
          {report.feedback.items.map((row) => (
            <button
              className="action-item"
              key={String(row.id)}
              onClick={() => navigate('feedback', String(row.id))}
            >
              <div>
                <b>{row.title}</b>
                <small>{new Date(String(row.created_at)).toLocaleString('zh-CN')}</small>
              </div>
              <span>处理 →</span>
            </button>
          ))}
          {!report.feedback.items.length && (
            <div className="empty">
              <p>{report.feedback.total ? '本页没有记录，请返回上一页' : '当前没有待处理反馈'}</p>
            </div>
          )}
          {queuePage(report.feedback, busy, (page) => changePage('feedback', page))}
        </article>
      </div>
      <p className="caption">
        {report.from} 至今日（UTC） · 更新于 {new Date(report.generatedAt).toLocaleString('zh-CN')}
        。应用访问按现有规则识别人类与机器人，仅反映已采集流量；流量增长请查看增长大盘。
      </p>
    </>
  );
}
