import {
  Bug,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Lightbulb,
  Loader2,
  MessageCircle,
  Send,
  Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePresenter } from '@/contexts/presenter-context';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { useCommunityStore } from '@/features/community/stores/community.store';
import type { FeedbackCategory, FeedbackPost, FeedbackStatus } from '@/types';

const CATEGORY_ICONS = {
  idea: Lightbulb,
  bug: Bug,
  question: CircleHelp,
} satisfies Record<Exclude<FeedbackCategory, 'general'>, typeof Lightbulb>;

const STATUS_STYLES: Record<FeedbackStatus, string> = {
  open: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  planned: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  in_progress: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  completed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
};

const STATUS_OPTIONS: FeedbackStatus[] = ['open', 'planned', 'in_progress', 'completed'];
const EMPTY_COMMENTS: [] = [];

const formatDate = (value: string, language: string): string =>
  new Intl.DateTimeFormat(language, {
    month: 'short',
    day: 'numeric',
    year: new Date(value).getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  }).format(new Date(value));

const AuthorAvatar: React.FC<{ name: string; avatarUrl: string | null }> = ({
  name,
  avatarUrl,
}) => (
  <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-500 to-violet-500 text-xs font-bold text-white">
    {avatarUrl ? (
      <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
    ) : (
      name.slice(0, 1).toUpperCase()
    )}
  </div>
);

export const FeedbackCard: React.FC<{ post: FeedbackPost }> = ({ post }) => {
  const { t, i18n } = useTranslation();
  const presenter = usePresenter();
  const authUser = useAuthStore((state) => state.user);
  const expanded = useCommunityStore((state) => state.expandedPostId === post.id);
  const storedComments = useCommunityStore((state) => state.commentsByPost[post.id]);
  const comments = storedComments ?? EMPTY_COMMENTS;
  const isLoadingComments = useCommunityStore((state) => state.loadingCommentsPostId === post.id);
  const commentDraft = useCommunityStore((state) => state.commentDrafts[post.id] ?? '');
  const isSubmittingComment = useCommunityStore(
    (state) => state.submittingCommentPostId === post.id
  );
  const actions = useCommunityStore((state) => state.actions);
  const CategoryIcon = post.category === 'general' ? null : CATEGORY_ICONS[post.category];
  const authorName =
    post.author.id === authUser?.id
      ? t('community.you')
      : post.author.displayName || post.author.handle || t('community.anonymous');

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/80 dark:hover:border-slate-700">
      <div className="p-4 md:p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {CategoryIcon && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                <CategoryIcon className="h-3.5 w-3.5" />
                {t(`community.categories.${post.category}`)}
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[post.status]}`}
            >
              {post.status === 'completed' ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <Clock3 className="h-3.5 w-3.5" />
              )}
              {t(`community.statuses.${post.status}`)}
            </span>
          </div>

          <h2 className="mt-2.5 text-base font-bold leading-snug text-slate-900 dark:text-white md:text-lg">
            {post.title}
          </h2>
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">
            {post.content}
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
            <div className="flex items-center gap-2 text-left">
              <AuthorAvatar name={authorName} avatarUrl={post.author.avatarUrl} />
              <span>
                <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {authorName}
                </span>
                <span className="block text-[11px] text-slate-400">
                  {formatDate(post.createdAt, i18n.language)}
                </span>
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {post.canUpdateStatus && (
                <select
                  value={post.status}
                  onChange={(event) =>
                    void presenter.community.setStatus(
                      post.id,
                      event.target.value as FeedbackStatus
                    )
                  }
                  aria-label={t('community.updateStatus')}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-600 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {t(`community.statuses.${status}`)}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={() => void presenter.community.toggleComments(post.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  expanded
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                    : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                <MessageCircle className="h-4 w-4" />
                {t('community.repliesCount', { count: post.commentsCount })}
              </button>
              {post.canDelete && (
                <button
                  type="button"
                  onClick={() => void presenter.community.deletePost(post.id)}
                  className="rounded-xl p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                  aria-label={t('community.deleteFeedback')}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-200 bg-slate-50/70 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/40 md:px-5">
          {isLoadingComments ? (
            <div className="flex items-center justify-center py-5 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : comments.length === 0 ? (
            <p className="py-3 text-center text-sm text-slate-400">{t('community.noReplies')}</p>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => {
                const commentAuthor =
                  comment.author.id === authUser?.id
                    ? t('community.you')
                    : comment.author.displayName ||
                      comment.author.handle ||
                      t('community.anonymous');
                return (
                  <div key={comment.id} className="flex gap-3">
                    <AuthorAvatar name={commentAuthor} avatarUrl={comment.author.avatarUrl} />
                    <div className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                          {commentAuthor}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-400">
                            {formatDate(comment.createdAt, i18n.language)}
                          </span>
                          {comment.canDelete && (
                            <button
                              type="button"
                              onClick={() =>
                                void presenter.community.deleteComment(post.id, comment.id)
                              }
                              className="text-slate-400 hover:text-red-500"
                              aria-label={t('common.delete')}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {comment.content}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-5 flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <textarea
                value={commentDraft}
                maxLength={800}
                rows={2}
                onChange={(event) => actions.setCommentDraft(post.id, event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === 'Enter' &&
                    (event.metaKey || event.ctrlKey) &&
                    commentDraft.trim()
                  ) {
                    event.preventDefault();
                    void presenter.community.submitComment(post.id);
                  }
                }}
                placeholder={t('community.replyPlaceholder')}
                className="block w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
              <p className="mt-1.5 px-1 text-[11px] text-slate-400">
                {t('community.replyShortcut')}
              </p>
            </div>
            <button
              type="button"
              disabled={!commentDraft.trim() || isSubmittingComment}
              onClick={() => void presenter.community.submitComment(post.id)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={t('community.sendReply')}
            >
              {isSubmittingComment ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      )}
    </article>
  );
};
