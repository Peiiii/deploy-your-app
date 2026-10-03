import { useEffect, useRef } from 'react';
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
}: {
  report: Overview;
  navigate: Navigate;
  busy: boolean;
  changePage: (queue: 'attention' | 'feedback', page: number) => void;
}) {
  const trend = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (trend.current) trend.current.scrollLeft = trend.current.scrollWidth;
  }, [report]);
  const max = Math.max(1, ...report.daily.map((row) => Number(row.total)));
  const ended = Number(report.deployments.succeeded) + Number(report.deployments.failed);
  const success = ended
    ? `${((Number(report.deployments.succeeded) / ended) * 100).toFixed(1)}%`
    : '—';
  return (
    <>
      <div className="operating-context">
        <div>
          <span className="eyebrow">PUBLISH · RETURN · RESOLVE</span>
          <h2>看增长，也把问题处理完</h2>
          <p className="muted">近 {report.days} 天（含今日 UTC） · 发布指标按创作者去重</p>
        </div>
        <button onClick={() => navigate('growth')}>查看流量与增长 ↗</button>
      </div>
      <div className="metrics business-metrics">
        {[
          ['成功发布创作者', report.publishing.publishers, '所选范围内至少一次部署成功'],
          ['首次发布创作者', report.publishing.firstPublishers, '记录中的第一次成功发生在本期'],
          ['再次发布创作者', report.publishing.repeatPublishers, '本期前已成功，本期再次成功'],
          [
            '部署成功率',
            success,
            `${count(report.deployments.succeeded)} 成功 / ${count(ended)} 已结束尝试`,
          ],
        ].map(([title, value, hint]) => (
          <article className="metric" key={String(title)}>
            <span>{title}</span>
            <strong>{title === '部署成功率' ? value : count(value)}</strong>
            <small>{hint}</small>
          </article>
        ))}
      </div>
      <p className="caption">
        发布指标仅覆盖已记录的部署历史；首次与再次互斥，不等同于用户留存率。处理中尝试不计入成功率。
      </p>
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
      <div className="operating-background">
        <span>
          累计用户 <b>{count(report.summary.users)}</b>（本期新增 {count(report.summary.newUsers)}）
        </span>
        <span>
          有效应用 <b>{count(report.summary.projects)}</b> · 上线 {count(report.summary.live)} ·
          公开上线 {count(report.summary.public)}
        </span>
        <span>
          本期已采集应用访问 <b>{count(report.traffic.humanViews)}</b> · 机器人{' '}
          {count(report.traffic.botViews)}
        </span>
      </div>
      <div className="two-columns dashboard-columns">
        <article className="panel">
          <div className="spread">
            <h3>每日部署趋势</h3>
            <span className="legend">紫色：全部 · 绿色：成功</span>
          </div>
          {Number(report.deployments.total) > 0 ? (
            <div ref={trend} className="trend business-trend" role="img" aria-label="每日部署趋势">
              {report.daily.map((row) => (
                <div className="bar-column" key={String(row.day)}>
                  <span>{count(row.total)}</span>
                  <div
                    className="bar"
                    title={`${row.day}：${row.total} 次，成功 ${row.succeeded}`}
                    style={{ height: `${Math.max(3, (Number(row.total) / max) * 160)}px` }}
                  >
                    <i
                      style={{
                        height: `${Number(row.total) ? (Number(row.succeeded) / Number(row.total)) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <small>{String(row.day).slice(5)}</small>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">
              <p>这段时间没有部署记录</p>
            </div>
          )}
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
        {report.from} 至今日（UTC） · 更新于 {new Date(report.generatedAt).toLocaleString('zh-CN')}
        。应用访问按现有规则识别人类与机器人，仅反映已采集流量；流量增长请查看增长大盘。
      </p>
    </>
  );
}
