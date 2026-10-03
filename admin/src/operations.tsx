import { useEffect, useState, type FormEvent } from 'react';
import { api } from './api';
import OperatingSummary, { type Overview } from './operating-summary';
import ProjectDetail from './project-detail';
import type { Navigate } from './navigation';
import { deploymentChannels, deploymentChannelLabel } from './deployment-channels';
import ProjectInventory from './project-inventory';
import {
  categoryLabels,
  languageLabel,
  projectLanguages,
  type Inventory,
} from './project-inventory-data';

type Row = Record<string, string | number | null>;
type List = { items: Row[]; total: number; page: number; limit: number; inventory?: Inventory };
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
  feedback_status: '反馈状态',
  feedback_reply: '团队回复',
  feedback_delete: '删除反馈',
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
export default function Operations({
  section,
  projectId,
  navigate,
}: {
  section: string;
  projectId: string;
  navigate: Navigate;
}) {
  const [days, setDays] = useState(7);
  const [actionPage, setActionPage] = useState(1);
  const [feedbackPage, setFeedbackPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [channel, setChannel] = useState('');
  const [category, setCategory] = useState('');
  const [language, setLanguage] = useState('');
  const [visibility, setVisibility] = useState('');
  const [query, setQuery] = useState('page=1');
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<List | Overview | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState<Row | null>(null);
  useEffect(() => {
    let active = true;
    api<List | Overview>(
      section === 'dashboard'
        ? `overview?days=${days}&actionPage=${actionPage}&feedbackPage=${feedbackPage}`
        : `${section}?${query}`
    )
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
  }, [section, days, query, revision, actionPage, feedbackPage]);
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
    setQuery(
      new URLSearchParams({
        q: search,
        status,
        channel,
        category,
        language,
        visibility,
        page: '1',
      }).toString()
    );
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
  if (section === 'projects' && projectId)
    return (
      <ProjectDetail
        key={projectId}
        id={projectId}
        updated={refresh}
        navigate={navigate}
        back={() => {
          navigate('projects');
          refresh();
        }}
      />
    );
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
          {section === 'dashboard' ? '经营数据 · UTC 日期' : '实时查询 · 每页 20 条'}
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
        <OperatingSummary
          report={report}
          revision={revision}
          days={days}
          navigate={navigate}
          busy={busy}
          changePage={(queue, page) => {
            setBusy(true);
            setError('');
            if (queue === 'attention') setActionPage(page);
            else setFeedbackPage(page);
          }}
        />
      )}
      {section === 'projects' && list?.inventory && <ProjectInventory data={list.inventory} />}
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
                  <select
                    aria-label="状态"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
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
              {['projects', 'deployments'].includes(section) && (
                <label>
                  {section === 'projects' ? '最近部署渠道' : '部署渠道'}
                  <select
                    aria-label="部署渠道"
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                  >
                    <option value="">全部渠道</option>
                    {Object.entries(deploymentChannels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                    {section === 'projects' && <option value="unrecorded">未记录</option>}
                  </select>
                </label>
              )}
              {section === 'projects' && (
                <>
                  <label>
                    分类
                    <select
                      aria-label="分类"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option value="">全部分类</option>
                      {Object.entries(categoryLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    应用语言
                    <select
                      aria-label="应用语言"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                    >
                      <option value="">全部语言</option>
                      {list?.inventory?.languages.map(({ name }) => (
                        <option key={name} value={name}>
                          {languageLabel(name)}
                        </option>
                      ))}
                      <option value="und">未确认</option>
                    </select>
                  </label>
                  <label>
                    公开设置
                    <select
                      aria-label="公开设置"
                      value={visibility}
                      onChange={(e) => setVisibility(e.target.value)}
                    >
                      <option value="">全部设置</option>
                      <option value="public">公开</option>
                      <option value="private">非公开</option>
                      <option value="unrecorded">未记录</option>
                    </select>
                  </label>
                </>
              )}
              <button className="primary" disabled={busy}>
                搜索
              </button>
              {section === 'projects' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setSearch('');
                    setStatus('');
                    setChannel('');
                    setCategory('');
                    setLanguage('');
                    setVisibility('');
                    setQuery('page=1');
                    refresh();
                  }}
                >
                  清空筛选
                </button>
              )}
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
                          ? [
                              '应用',
                              '分类 / 界面语言',
                              '所属用户',
                              '状态',
                              '首次 / 最近部署渠道',
                              '公开展示',
                              '最近部署',
                              '操作',
                            ]
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
                              {categoryLabels[String(row.category)] ||
                                row.category ||
                                '其他 / 未分类'}
                              <small className="cell-sub">
                                {projectLanguages(row.languages).map(languageLabel).join('、') ||
                                  '语言未确认'}
                              </small>
                            </td>
                            <td>
                              {row.owner_name || row.owner_email || '未关联用户'}
                              <small className="cell-sub">{row.owner_email}</small>
                            </td>
                            <td>{statusTag(row.status)}</td>
                            <td className="nowrap">
                              {deploymentChannelLabel(row.first_channel)}
                              <small className="cell-sub">
                                最近：{deploymentChannelLabel(row.latest_channel)}
                              </small>
                            </td>
                            <td>
                              {row.is_public === 1
                                ? '公开'
                                : row.is_public === 0
                                  ? '非公开'
                                  : '未记录'}
                            </td>
                            <td className="nowrap">{date(row.last_deployed)}</td>
                            <td className="table-actions">
                              <button onClick={() => navigate('projects', String(row.id))}>
                                详情
                              </button>
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
                              <small className="cell-sub">
                                {deploymentChannelLabel(row.client_channel)}
                              </small>
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
