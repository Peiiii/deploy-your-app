import { useEffect, useState, type FormEvent } from 'react';
import { api } from './api';

type Row = Record<string, string | number | null>;
type List = { items: Row[]; total: number; page: number; limit: number };
type Overview = {
  days: number;
  from: string;
  generatedAt: number;
  summary: Row;
  deployments: Row;
  daily: Row[];
  sources: Row[];
  errors: Row[];
  traffic: Row;
};
const count = (value: unknown) => Number(value || 0).toLocaleString('zh-CN');
const date = (value: unknown) =>
  value ? new Date(String(value)).toLocaleString('zh-CN', { hour12: false }) : '—';
const labels: Record<string, string> = {
  Live: '已上线',
  Building: '部署中',
  Failed: '失败',
  started: '已开始',
  accepted: '处理中',
  succeeded: '成功',
  failed: '失败',
  rejected: '已拒绝',
  visibility: '应用公开性',
  revoke_sessions: '撤销登录',
  password_changed: '修改密码',
};
const statusTag = (value: unknown) => (
  <span className={`tag status-${String(value)}`}>
    {labels[String(value)] || String(value || '—')}
  </span>
);
const safeUrl = (value: unknown) => {
  try {
    const url = new URL(String(value));
    return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
};
const Pagination = ({
  list,
  busy,
  change,
}: {
  list: List;
  busy: boolean;
  change: (page: number) => void;
}) => (
  <div className="pagination">
    <span>
      共 {count(list.total)} 条 · 第 {list.page} / {Math.max(1, Math.ceil(list.total / list.limit))}{' '}
      页
    </span>
    <button disabled={busy || list.page <= 1} onClick={() => change(list.page - 1)}>
      上一页
    </button>
    <button
      disabled={busy || list.page * list.limit >= list.total}
      onClick={() => change(list.page + 1)}
    >
      下一页
    </button>
  </div>
);
export default function Operations({ section }: { section: string }) {
  const [days, setDays] = useState(7);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('page=1');
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<List | Overview | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState<Row | null>(null);
  useEffect(() => {
    let active = true;
    api<List | Overview>(section === 'dashboard' ? `overview?days=${days}` : `${section}?${query}`)
      .then((value) => {
        if (active) setData(value);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : '请求失败');
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [section, days, query, revision]);
  const refresh = () => {
    setBusy(true);
    setError('');
    setRevision((value) => value + 1);
  };
  const changePage = (page: number) => {
    const params = new URLSearchParams(query);
    params.set('page', String(page));
    setBusy(true);
    setError('');
    setQuery(params.toString());
  };
  const filter = (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setPending(null);
    setQuery(new URLSearchParams({ q: search, status, page: '1' }).toString());
    setRevision((value) => value + 1);
  };
  const manage = async () => {
    if (!pending) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await api<{ revoked?: number }>(
        'manage',
        section === 'users'
          ? { action: 'revoke_sessions', id: pending.id }
          : {
              action: 'visibility',
              id: pending.id,
              expected: Boolean(pending.is_public ?? 1),
              isPublic: !(pending.is_public ?? 1),
            }
      );
      setNotice(
        section === 'users'
          ? `已撤销 ${result.revoked || 0} 个主站登录会话`
          : '应用公开展示设置已保存'
      );
      setPending(null);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
      setBusy(false);
    }
  };
  const report = section === 'dashboard' ? (data as Overview | null) : null;
  const list = section !== 'dashboard' ? (data as List | null) : null;
  const max = Math.max(1, ...(report?.daily.map((row) => Number(row.total)) || []));
  return (
    <>
      <div className="operations-toolbar">
        {section === 'dashboard' && (
          <div className="period-tabs" aria-label="统计范围">
            {[7, 30].map((value) => (
              <button
                key={value}
                disabled={busy}
                className={value === days ? 'selected' : ''}
                onClick={() => {
                  setBusy(true);
                  setError('');
                  setDays(value);
                  setRevision((v) => v + 1);
                }}
              >
                近 {value} 天
              </button>
            ))}
          </div>
        )}
        <span className="muted">
          {section === 'dashboard' ? '业务数据库 · UTC 日期' : '实时查询 · 每页 20 条'}
        </span>
        <button disabled={busy} onClick={refresh}>
          {busy ? '加载中…' : '刷新数据 ↻'}
        </button>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}{' '}
          <button disabled={busy} onClick={refresh}>
            重试
          </button>
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
      {busy && !data && (
        <article className="panel loading-panel" role="status">
          正在读取{section === 'dashboard' ? '经营数据' : '记录'}…
        </article>
      )}
      {report && (
        <>
          <div className="metrics business-metrics">
            {[
              [
                '注册用户',
                report.summary.users,
                `近 ${days} 天新增 ${count(report.summary.newUsers)}`,
              ],
              [
                '有效应用',
                report.summary.projects,
                `${count(report.summary.live)} 已上线 · ${count(report.summary.public)} 公开展示`,
              ],
              [
                '部署尝试',
                report.deployments.total,
                `${count(report.deployments.pending)} 处理中 · ${count(report.deployments.failed)} 失败/拒绝`,
              ],
              [
                '真人应用访问',
                report.traffic.humanViews,
                `已识别机器人访问 ${count(report.traffic.botViews)}`,
              ],
            ].map(([title, value, hint]) => (
              <article className="metric" key={String(title)}>
                <span>{title}</span>
                <strong>{count(value)}</strong>
                <small>{hint}</small>
              </article>
            ))}
          </div>
          <div className="two-columns dashboard-columns">
            <article className="panel">
              <div className="spread">
                <h3>部署趋势</h3>
                <span className="legend">紫色：全部 · 绿色：成功</span>
              </div>
              {Number(report.deployments.total) > 0 ? (
                <div className="trend business-trend" role="img" aria-label="每日部署趋势">
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
                开始日期在所选范围内的部署尝试；未结束的尝试单独计为处理中。
              </p>
            </article>
            <article className="panel success-panel">
              <span className="eyebrow">DEPLOYMENT HEALTH</span>
              <h3>部署成功率</h3>
              <strong className="success-value">
                {Number(report.deployments.succeeded) + Number(report.deployments.failed) > 0
                  ? `${((Number(report.deployments.succeeded) / (Number(report.deployments.succeeded) + Number(report.deployments.failed))) * 100).toFixed(1)}%`
                  : '—'}
              </strong>
              <p className="muted">成功 / 已结束尝试（含拒绝），不包含处理中。</p>
              <div className="result-grid">
                <div>
                  <strong>{count(report.deployments.succeeded)}</strong>
                  <span>成功</span>
                </div>
                <div>
                  <strong>{count(report.deployments.failed)}</strong>
                  <span>失败 / 拒绝</span>
                </div>
                <div>
                  <strong>{count(report.summary.building)}</strong>
                  <span>当前部署中应用</span>
                </div>
              </div>
            </article>
            <article className="panel">
              <h3>部署来源</h3>
              {report.sources.length ? (
                report.sources.map((row) => (
                  <div className="row" key={String(row.name)}>
                    <span>{row.name || '未记录来源'}</span>
                    <strong>{count(row.total)} 次</strong>
                  </div>
                ))
              ) : (
                <p className="muted">暂无来源数据</p>
              )}
            </article>
            <article className="panel">
              <h3>需要关注的失败原因</h3>
              {report.errors.length ? (
                report.errors.map((row) => (
                  <div className="row" key={String(row.name)}>
                    <code>{row.name === 'unknown' ? '未记录错误代码' : row.name}</code>
                    <strong>{count(row.total)} 次</strong>
                  </div>
                ))
              ) : (
                <p className="muted">当前范围内没有失败记录</p>
              )}
            </article>
          </div>
          <p className="caption">
            范围：{report.from} 至今日（UTC） · 更新于{' '}
            {new Date(report.generatedAt).toLocaleString('zh-CN')}
            。用户和应用为当前累计；部署和访问为所选范围。真人识别为现有流量规则的分类结果。
          </p>
        </>
      )}
      {section !== 'dashboard' && (
        <article className="panel">
          {section !== 'audit' && (
            <form className="event-controls management-search" onSubmit={filter}>
              <label>
                搜索
                <input
                  value={search}
                  maxLength={100}
                  placeholder={
                    section === 'users'
                      ? '姓名、邮箱、handle 或用户 ID'
                      : section === 'projects'
                        ? '应用、slug、邮箱或用户 ID'
                        : '应用名称或部署 / 应用 ID'
                  }
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              {section !== 'users' && (
                <label>
                  状态
                  <select value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="">全部状态</option>
                    {(section === 'projects'
                      ? ['Live', 'Building', 'Failed']
                      : ['started', 'accepted', 'succeeded', 'failed', 'rejected']
                    ).map((value) => (
                      <option key={value} value={value}>
                        {labels[value]}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button className="primary" disabled={busy}>
                搜索
              </button>
            </form>
          )}
          {pending && (
            <div className="confirm-box" role="alert">
              <div>
                <strong>
                  {section === 'users'
                    ? `撤销 ${pending.display_name || pending.email || pending.id} 的登录会话？`
                    : `将「${pending.name}」${(pending.is_public ?? 1) ? '取消' : '设为'}公开展示？`}
                </strong>
                <p>
                  {section === 'users'
                    ? '用户将需要重新登录。账号和应用会保留。'
                    : '控制平台公开展示；应用原链接仍可访问。'}
                </p>
              </div>
              <div>
                <button disabled={busy} onClick={() => setPending(null)}>
                  取消
                </button>
                <button disabled={busy} className="primary" onClick={() => void manage()}>
                  确认修改
                </button>
              </div>
            </div>
          )}
          {list && (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {(section === 'users'
                        ? ['用户', '邮箱 / handle', '注册时间', '应用 / 有效会话', '操作']
                        : section === 'projects'
                          ? ['应用', '所属用户', '状态', '公开展示', '最近部署', '操作']
                          : section === 'deployments'
                            ? ['应用 / 部署', '来源 / 渠道', '状态', '开始时间', '耗时', '错误代码']
                            : ['时间', '管理员', '操作', '资源', '说明']
                      ).map((title) => (
                        <th key={title}>{title}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {list.items.map((row) => (
                      <tr key={String(row.id)}>
                        {section === 'users' ? (
                          <>
                            <td>
                              <b>{row.display_name || '未设置姓名'}</b>
                              <small className="cell-sub">{row.id}</small>
                            </td>
                            <td>
                              {row.email || '—'}
                              <small className="cell-sub">
                                {row.handle ? `@${row.handle}` : '—'}
                              </small>
                            </td>
                            <td className="nowrap">{date(row.created_at)}</td>
                            <td>
                              {count(row.projects)} 应用 / {count(row.sessions)} 会话
                            </td>
                            <td>
                              <button disabled={busy} onClick={() => setPending(row)}>
                                撤销登录
                              </button>
                            </td>
                          </>
                        ) : section === 'projects' ? (
                          <>
                            <td>
                              <b>{row.name}</b>
                              <small className="cell-sub">{row.slug || row.id}</small>
                            </td>
                            <td>
                              {row.owner_name || row.owner_email || '未关联用户'}
                              <small className="cell-sub">{row.owner_email}</small>
                            </td>
                            <td>{statusTag(row.status)}</td>
                            <td>{(row.is_public ?? 1) ? '公开' : '非公开'}</td>
                            <td className="nowrap">{date(row.last_deployed)}</td>
                            <td className="table-actions">
                              {safeUrl(row.url) && (
                                <a
                                  className="text-button"
                                  href={safeUrl(row.url)}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  打开 ↗
                                </a>
                              )}
                              <button disabled={busy} onClick={() => setPending(row)}>
                                {(row.is_public ?? 1) ? '取消公开' : '设为公开'}
                              </button>
                            </td>
                          </>
                        ) : section === 'deployments' ? (
                          <>
                            <td>
                              <b>{row.name || '应用已删除'}</b>
                              <small className="cell-sub">{row.id}</small>
                            </td>
                            <td>
                              {row.source_type}
                              <small className="cell-sub">{row.client_channel}</small>
                            </td>
                            <td>{statusTag(row.status)}</td>
                            <td className="nowrap">{date(row.started_at)}</td>
                            <td>
                              {row.duration_ms == null
                                ? '—'
                                : `${(Number(row.duration_ms) / 1000).toFixed(1)}s`}
                            </td>
                            <td>
                              <code>{row.error_code || '—'}</code>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="nowrap">
                              {new Date(Number(row.at)).toLocaleString('zh-CN')}
                            </td>
                            <td>{row.username}</td>
                            <td>{labels[String(row.action)] || row.action}</td>
                            <td className="resource-id">{row.target_id}</td>
                            <td>{row.detail}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!list.items.length && (
                <div className="empty">
                  <p>
                    {section === 'audit'
                      ? '还没有管理操作记录'
                      : '没有匹配的记录，试试调整搜索条件'}
                  </p>
                </div>
              )}
              <Pagination list={list} busy={busy} change={changePage} />
            </>
          )}
        </article>
      )}
    </>
  );
}
