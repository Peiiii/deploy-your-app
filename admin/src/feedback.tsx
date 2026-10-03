import { useEffect, useState, type FormEvent } from 'react';
import { api } from './api';
import type { Navigate } from './navigation';

type Post = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  category: string;
  status: string;
  created_at: string;
  updated_at: string;
  email: string | null;
  display_name: string | null;
  handle: string | null;
  comments_count: number;
};
type Comment = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  display_name: string | null;
  handle: string | null;
  is_team: number;
};
type List = {
  items: Post[];
  total: number;
  page: number;
  limit: number;
  counts: { status: string; total: number }[];
};
type Detail = { item: Post; comments: Comment[]; total: number; page: number; limit: number };
const statuses: Record<string, string> = {
  open: '待处理',
  planned: '已计划',
  in_progress: '处理中',
  completed: '已完成',
};
const categories: Record<string, string> = {
  general: '一般反馈',
  idea: '功能建议',
  bug: '问题报告',
  question: '使用咨询',
};
const time = (value: string) => new Date(value).toLocaleString('zh-CN', { hour12: false });
const author = (post: Post) => post.display_name || post.handle || post.email || post.user_id;

export default function Feedback({
  selectedId,
  owner,
  navigate,
}: {
  selectedId: string;
  owner: string;
  navigate: Navigate;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState(() => new URLSearchParams({ page: '1', owner }).toString());
  const [revision, setRevision] = useState(0);
  const [list, setList] = useState<List | null>(null);
  const selected = selectedId;
  const [commentPage, setCommentPage] = useState(1);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [nextStatus, setNextStatus] = useState('');
  const [draft, setDraft] = useState('');
  const [replyId, setReplyId] = useState(() => crypto.randomUUID());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [noticeFor, setNoticeFor] = useState(selected);
  useEffect(() => {
    setDetail(null);
    setCommentPage(1);
    setDraft('');
    setReplyId(crypto.randomUUID());
    setConfirmDelete(false);
    setError('');
    setLoading(true);
  }, [selected]);
  useEffect(() => {
    setSearch('');
    setStatus('');
    setCategory('');
    setQuery(new URLSearchParams({ page: '1', owner }).toString());
    setLoading(true);
  }, [owner]);
  useEffect(() => {
    let active = true;
    const route = selected
      ? `feedback/${encodeURIComponent(selected)}?page=${commentPage}`
      : `feedback?${query}`;
    api<List | Detail>(route)
      .then((data) => {
        if (!active) return;
        if ('item' in data) {
          setDetail(data);
          setNextStatus(data.item.status);
        } else setList(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : '反馈加载失败');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [query, revision, selected, commentPage]);
  const refresh = () => {
    setLoading(true);
    setError('');
    setRevision((n) => n + 1);
  };
  const open = (id: string) => {
    navigate('feedback', id, owner);
    setDetail(null);
    setCommentPage(1);
    setDraft('');
    setReplyId(crypto.randomUUID());
    setConfirmDelete(false);
    setError('');
    setNotice('');
    setLoading(true);
  };
  const filter = (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setNotice('');
    setQuery(new URLSearchParams({ q: search, status, category, page: '1', owner }).toString());
    setRevision((n) => n + 1);
  };
  const page = (number: number) => {
    setLoading(true);
    setError('');
    if (selected) setCommentPage(number);
    else {
      const params = new URLSearchParams(query);
      params.set('page', String(number));
      setQuery(params.toString());
    }
  };
  const manage = async (action: 'status' | 'reply' | 'delete') => {
    if (!detail || writing) return;
    setWriting(true);
    setNoticeFor(action === 'delete' ? '' : selected);
    setError('');
    setNotice('');
    try {
      await api('feedback/manage', {
        id: selected,
        action,
        ...(action === 'status'
          ? { status: nextStatus, expected: detail.item.status }
          : action === 'reply'
            ? { content: draft, replyId }
            : {}),
      });
      if (action === 'delete') {
        open('');
        setNotice('反馈已删除。');
      } else {
        if (action === 'reply') {
          setDraft('');
          setReplyId(crypto.randomUUID());
          setCommentPage(Math.ceil((detail.total + 1) / 100));
          setNotice('团队回复已发布，提交用户可以在主站看到。');
        } else setNotice('处理状态已更新，已同步到主站。');
        refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setWriting(false);
    }
  };
  const pagination = (data: List | Detail, label: string) => (
    <div className="pagination">
      <span>
        {label}共 {data.total} 条 · 第 {data.page} /{' '}
        {Math.max(1, Math.ceil(data.total / data.limit))} 页
      </span>
      <button disabled={loading || writing || data.page <= 1} onClick={() => page(data.page - 1)}>
        上一页
      </button>
      <button
        disabled={loading || writing || data.page * data.limit >= data.total}
        onClick={() => page(data.page + 1)}
      >
        下一页
      </button>
    </div>
  );
  return (
    <div className="feedback-console">
      <div className="spread feedback-heading">
        <p className="muted">私密反馈仅提交用户与管理员可见，处理结果与主站同步。</p>
        <div className="button-row">
          {selected && (
            <button disabled={writing} onClick={() => open('')}>
              ← 返回反馈列表
            </button>
          )}
          <button disabled={loading || writing} onClick={refresh}>
            刷新反馈
          </button>
        </div>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
          <button disabled={writing} onClick={refresh}>
            重试 / 刷新
          </button>
        </div>
      )}
      {notice && noticeFor === selected && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
      {loading && (
        <p className="muted" role="status">
          正在加载反馈…
        </p>
      )}
      {!selected && owner && (
        <div className="notice">
          正在查看指定创作者的反馈{' '}
          <button onClick={() => navigate('feedback')}>查看全部反馈</button>
        </div>
      )}
      {!selected && (
        <>
          {list && (
            <div className="metrics feedback-counts">
              {Object.entries(statuses).map(([key, label]) => (
                <article className="metric" key={key}>
                  <small>{label}</small>
                  <strong>{list.counts.find((c) => c.status === key)?.total || 0}</strong>
                  <span className="muted">全部有效反馈</span>
                </article>
              ))}
            </div>
          )}
          <form className="filters" onSubmit={filter}>
            <label>
              搜索
              <input
                placeholder="标题、内容、用户邮箱或名称"
                value={search}
                maxLength={100}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <label>
              处理状态
              <select
                aria-label="处理状态"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">全部状态</option>
                {Object.entries(statuses).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              反馈分类
              <select
                aria-label="反馈分类"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">全部分类</option>
                {Object.entries(categories).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary" disabled={loading}>
              应用筛选
            </button>
          </form>
          {list && (
            <article className="panel">
              <div className="feedback-inbox">
                {list.items.map((item) => (
                  <button
                    className="feedback-entry"
                    key={item.id}
                    disabled={loading}
                    onClick={() => open(item.id)}
                  >
                    <div className="spread">
                      <strong>{item.title}</strong>
                      <span className={`tag feedback-${item.status}`}>{statuses[item.status]}</span>
                    </div>
                    <p>{item.content}</p>
                    <small>
                      {categories[item.category]} · {author(item)} · {item.comments_count} 条回复 ·
                      更新于 {time(item.updated_at)}
                    </small>
                  </button>
                ))}
              </div>
              {!list.items.length && (
                <div className="empty">
                  <p>没有符合筛选条件的反馈。</p>
                </div>
              )}
              {pagination(list, '反馈')}
            </article>
          )}
        </>
      )}
      {selected && detail && (
        <div className="feedback-layout">
          <article className="panel feedback-thread">
            <div className="spread">
              <span className="eyebrow">{categories[detail.item.category]}</span>
              <span className={`tag feedback-${detail.item.status}`}>
                {statuses[detail.item.status]}
              </span>
            </div>
            <h2>{detail.item.title}</h2>
            <p className="muted">
              {author(detail.item)} · {detail.item.email || '未提供邮箱'} ·{' '}
              {time(detail.item.created_at)}
            </p>
            <p className="feedback-content">{detail.item.content}</p>
            <h3>
              讨论记录 <small className="muted">{detail.total} 条</small>
            </h3>
            {!detail.comments.length && <p className="muted">还没有回复，可以先回应用户的问题。</p>}
            {detail.comments.map((comment) => (
              <div
                className={`feedback-comment ${comment.is_team ? 'team-reply' : ''}`}
                key={comment.id}
              >
                <div className="spread">
                  <strong>
                    {comment.is_team
                      ? 'GemiGo 团队'
                      : comment.display_name || comment.handle || comment.user_id}
                  </strong>
                  <small className="muted">{time(comment.created_at)}</small>
                </div>
                <p className="feedback-content">{comment.content}</p>
              </div>
            ))}
            {detail.total > 100 && pagination(detail, '回复')}
            <form
              className="feedback-reply"
              onSubmit={(e) => {
                e.preventDefault();
                void manage('reply');
              }}
            >
              <label htmlFor="team-reply">团队回复</label>
              <textarea
                id="team-reply"
                value={draft}
                maxLength={800}
                disabled={writing || loading}
                placeholder="回复内容会展示给提交用户。"
                onChange={(e) => {
                  setDraft(e.target.value);
                  setReplyId(crypto.randomUUID());
                }}
              />
              <div className="spread">
                <small className="muted">{draft.length}/800 · 以 GemiGo 团队身份发布</small>
                <button className="primary" disabled={writing || loading || !draft.trim()}>
                  {writing ? '提交中…' : '发布团队回复'}
                </button>
              </div>
            </form>
          </article>
          <section className="panel feedback-actions">
            <h3>处理反馈</h3>
            <label htmlFor="feedback-status">处理状态</label>
            <select
              id="feedback-status"
              value={nextStatus}
              disabled={writing || loading}
              onChange={(e) => setNextStatus(e.target.value)}
            >
              {Object.entries(statuses).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </select>
            <button
              className="primary"
              disabled={writing || loading || nextStatus === detail.item.status}
              onClick={() => void manage('status')}
            >
              保存处理状态
            </button>
            <p className="muted">状态变化会同步到用户的反馈页。回复和管理操作会记录到操作记录。</p>
            <hr />
            <small className="muted">反馈 ID</small>
            <code>{detail.item.id}</code>
            {confirmDelete ? (
              <div className="confirmation">
                <p>确认删除这条反馈？用户将无法继续查看该反馈及讨论。</p>
                <div className="button-row">
                  <button disabled={writing} onClick={() => setConfirmDelete(false)}>
                    取消
                  </button>
                  <button
                    className="danger"
                    disabled={writing || loading}
                    onClick={() => void manage('delete')}
                  >
                    确认删除反馈
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="danger"
                disabled={writing || loading}
                onClick={() => setConfirmDelete(true)}
              >
                删除反馈
              </button>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
