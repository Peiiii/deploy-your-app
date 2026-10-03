import { useEffect, useState } from 'react';
import { api } from './api';
import type { Navigate } from './navigation';
import { categoryLabels, languageLabel, projectLanguages } from './project-inventory-data';
import { deploymentChannelLabel } from './deployment-channels';

type Row = Record<string, string | number | null>;
type Detail = {
  item: Row;
  deployments: { items: Row[]; total: number; page: number; limit: number };
  traffic: { days: number; from: string; hasRecords: boolean; daily: Row[] };
  feedback: { items: Row[]; total: number };
};
const count = (value: unknown) => Number(value || 0).toLocaleString('zh-CN');
const time = (value: unknown) =>
  value ? new Date(String(value)).toLocaleString('zh-CN', { hour12: false }) : '未记录';
const statuses: Record<string, string> = {
  Live: '已上线',
  Building: '部署中',
  Failed: '失败',
  started: '已开始',
  accepted: '处理中',
  succeeded: '成功',
  failed: '失败',
  rejected: '已拒绝',
  open: '待处理',
  planned: '已计划',
  in_progress: '处理中',
  completed: '已完成',
};
const appUrl = (value: unknown) => {
  try {
    const url = new URL(String(value));
    return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
};
export default function ProjectDetail({
  id,
  navigate,
  back,
  updated,
}: {
  id: string;
  navigate: Navigate;
  back: () => void;
  updated: () => void;
}) {
  const [days, setDays] = useState(7);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [writing, setWriting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api<Detail>(`projects/${encodeURIComponent(id)}?days=${days}&page=${page}`)
      .then((value) => {
        if (active) setData(value);
      })
      .catch((err) => {
        if (active) {
          setData(null);
          setError(err instanceof Error ? err.message : '详情读取失败');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, days, page, revision]);
  const manage = async () => {
    if (!data || writing) return;
    setWriting(true);
    setError('');
    setNotice('');
    try {
      await api('manage', {
        action: 'visibility',
        id,
        expected: Boolean(data.item.is_public ?? 1),
        isPublic: !(data.item.is_public ?? 1),
      });
      setConfirm(false);
      setNotice('应用公开展示设置已保存');
      updated();
      setRevision((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : '修改失败');
    } finally {
      setWriting(false);
    }
  };
  const item = data?.item;
  return (
    <div className="project-detail">
      <div className="operations-toolbar">
        <button disabled={writing} onClick={back}>
          ← 返回应用列表
        </button>
        <button disabled={loading || writing} onClick={() => setRevision((n) => n + 1)}>
          刷新详情
        </button>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}{' '}
          <button disabled={writing} onClick={() => setRevision((n) => n + 1)}>
            重试 / 刷新
          </button>
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
      {loading && (
        <p role="status" className="muted">
          正在读取应用详情…
        </p>
      )}
      {item && data && (
        <>
          <article className="panel project-profile">
            <div className="spread">
              <div>
                <span className="eyebrow">APPLICATION</span>
                <h2>{item.name || item.id}</h2>
                <p className="muted">{item.slug || item.id}</p>
              </div>
              <span className={`tag status-${item.status}`}>
                {statuses[String(item.status)] || item.status}
              </span>
            </div>
            <div className="project-facts">
              <div>
                <span>创作者</span>
                <b>{item.owner_name || item.owner_email || item.owner_id || '未关联用户'}</b>
                <small>{item.owner_email || item.owner_id}</small>
              </div>
              <div>
                <span>类别 / 界面语言</span>
                <b>{categoryLabels[String(item.category)] || '其他 / 未分类'}</b>
                <small>
                  {projectLanguages(item.languages).map(languageLabel).join('、') || '语言未确认'}
                </small>
              </div>
              <div>
                <span>公开展示</span>
                <b>{item.is_public === 1 ? '公开' : item.is_public === 0 ? '非公开' : '未记录'}</b>
                <small>控制平台展示，原链接仍可访问</small>
              </div>
              <div>
                <span>首次 / 最近部署渠道</span>
                <b>{deploymentChannelLabel(item.first_channel)}</b>
                <small>最近：{deploymentChannelLabel(item.latest_channel)}</small>
              </div>
              <div>
                <span>创建时间</span>
                <b>{time(item.created_at)}</b>
              </div>
              <div>
                <span>最近成功上线</span>
                <b>{time(item.last_success_at)}</b>
                <small>最近部署：{time(item.last_deployed)}</small>
              </div>
            </div>
            <div className="button-row">
              {appUrl(item.url) && (
                <a className="text-button" href={appUrl(item.url)} target="_blank" rel="noreferrer">
                  打开应用 ↗
                </a>
              )}
              <button
                disabled={loading || writing}
                onClick={() => {
                  setConfirm(true);
                  setNotice('');
                }}
              >
                {(item.is_public ?? 1) ? '取消公开' : '设为公开'}
              </button>
            </div>
            {confirm && (
              <div className="confirm-box" role="alert">
                <div>
                  <strong>
                    将「{item.name}」{(item.is_public ?? 1) ? '取消' : '设为'}公开展示？
                  </strong>
                  <p>控制平台公开展示；应用原链接仍可访问。</p>
                </div>
                <div>
                  <button disabled={writing} onClick={() => setConfirm(false)}>
                    取消
                  </button>
                  <button
                    disabled={writing || loading}
                    className="primary"
                    onClick={() => void manage()}
                  >
                    确认修改
                  </button>
                </div>
              </div>
            )}
          </article>
          <article className="panel">
            <div className="spread">
              <h3>部署历史</h3>
              <span className="muted">按开始时间排序，最新记录在前</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {['状态 / 错误代码', '来源 / 渠道', '开始时间', '完成时间', '耗时'].map((v) => (
                      <th key={v}>{v}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.deployments.items.map((row) => (
                    <tr key={String(row.id)}>
                      <td>
                        <span className={`tag status-${row.status}`}>
                          {statuses[String(row.status)] || row.status}
                        </span>
                        <small className="cell-sub">
                          <code>{row.error_code || '—'}</code>
                        </small>
                        <small className="cell-sub resource-id">{row.id}</small>
                      </td>
                      <td>
                        {row.source_type || '未记录'}
                        <small className="cell-sub">
                          {deploymentChannelLabel(row.client_channel)}
                        </small>
                      </td>
                      <td className="nowrap">{time(row.started_at)}</td>
                      <td className="nowrap">{time(row.finished_at)}</td>
                      <td>
                        {row.duration_ms == null
                          ? '—'
                          : `${(Number(row.duration_ms) / 1000).toFixed(1)}s`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.deployments.items.length && (
              <div className="empty">
                <p>没有已记录的部署历史</p>
              </div>
            )}
            <div className="pagination">
              <span>
                共 {count(data.deployments.total)} 条 · 第 {data.deployments.page} 页
              </span>
              <button
                disabled={loading || writing || page <= 1}
                onClick={() => setPage((n) => n - 1)}
              >
                上一页
              </button>
              <button
                disabled={loading || writing || page * 20 >= data.deployments.total}
                onClick={() => setPage((n) => n + 1)}
              >
                下一页
              </button>
            </div>
          </article>
          <article className="panel">
            <div className="spread">
              <h3>每日应用访问</h3>
              <div className="segmented">
                {[7, 30].map((n) => (
                  <button
                    disabled={writing}
                    key={n}
                    className={days === n ? 'selected' : ''}
                    onClick={() => setDays(n)}
                  >
                    近 {n} 天
                  </button>
                ))}
              </div>
            </div>
            <p className="muted">
              {data.traffic.from} 至今日（UTC）。仅反映已采集流量；每日访客分别去重，不跨日累加为
              UV。
            </p>
            {!data.traffic.hasRecords && (
              <div className="empty">
                <p>这段时间未采集到访问记录</p>
                <small>可能尚未开始采集，不能据此判断无人使用。</small>
              </div>
            )}
            {data.traffic.hasRecords && (
              <div className="table-wrap traffic-daily">
                <table>
                  <thead>
                    <tr>
                      <th>日期</th>
                      <th>人类访问</th>
                      <th>机器人访问</th>
                      <th>当日去重访客</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.traffic.daily.map((row) => (
                      <tr key={String(row.day)}>
                        <td>{row.day}</td>
                        <td>{count(row.humanViews)}</td>
                        <td>{count(row.botViews)}</td>
                        <td>{count(row.dailyVisitors)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
          <article className="panel">
            <div className="spread">
              <h3>该创作者的反馈</h3>
              {item.owner_id && (
                <button onClick={() => navigate('feedback', '', String(item.owner_id))}>
                  查看全部 {count(data.feedback.total)} 条 →
                </button>
              )}
            </div>
            <p className="muted">
              反馈目前未关联具体应用；以下仅表示来自同一创作者，按最近提交展示。
            </p>
            {data.feedback.items.map((row) => (
              <button
                className="action-item"
                key={String(row.id)}
                onClick={() => navigate('feedback', String(row.id), String(item.owner_id || ''))}
              >
                <div>
                  <b>{row.title}</b>
                  <small>
                    {time(row.created_at)} · {statuses[String(row.status)] || row.status}
                  </small>
                </div>
                <span>查看讨论 →</span>
              </button>
            ))}
            {!data.feedback.items.length && (
              <div className="empty">
                <p>该创作者暂无反馈</p>
              </div>
            )}
          </article>
        </>
      )}
    </div>
  );
}
