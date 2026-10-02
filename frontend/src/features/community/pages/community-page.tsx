import {
  Inbox,
  LockKeyhole,
  Loader2,
  MessageSquarePlus,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PageLayout } from '@/components/page-layout';
import { usePresenter } from '@/contexts/presenter-context';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { FeedbackCard } from '@/features/community/components/feedback-card';
import { FeedbackComposer } from '@/features/community/components/feedback-composer';
import { useCommunityStore } from '@/features/community/stores/community.store';
import type { FeedbackCategory, FeedbackStatus } from '@/types';

const CATEGORY_FILTERS: Array<FeedbackCategory | null> = [
  null,
  'general',
  'idea',
  'bug',
  'question',
];
const STATUS_FILTERS: Array<FeedbackStatus | null> = [
  null,
  'open',
  'planned',
  'in_progress',
  'completed',
];

export const CommunityPage: React.FC = () => {
  const { t } = useTranslation();
  const presenter = usePresenter();
  const authUser = useAuthStore((state) => state.user);
  const authLoading = useAuthStore((state) => state.isLoading);
  const posts = useCommunityStore((state) => state.posts);
  const total = useCommunityStore((state) => state.total);
  const categoryFilter = useCommunityStore((state) => state.categoryFilter);
  const statusFilter = useCommunityStore((state) => state.statusFilter);
  const isLoading = useCommunityStore((state) => state.isLoading);
  const error = useCommunityStore((state) => state.error);
  const composerOpen = useCommunityStore((state) => state.composerOpen);
  const actions = useCommunityStore((state) => state.actions);
  const authUserId = authUser?.id;
  const isAdmin = Boolean(authUser?.isAdmin);

  useEffect(() => {
    presenter.community.clearPrivateFeedback();
    if (authLoading || !authUserId) return;
    void presenter.community.loadPosts();
  }, [authLoading, authUserId, categoryFilter, isAdmin, presenter.community, statusFilter]);

  return (
    <PageLayout
      title={t('community.title')}
      actions={
        authUser ? (
          <button
            type="button"
            onClick={presenter.community.openComposer}
            aria-label={t('community.newFeedback')}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/20 transition hover:bg-brand-700"
          >
            <MessageSquarePlus className="h-4 w-4" />
            <span className="hidden sm:inline">{t('community.newFeedback')}</span>
          </button>
        ) : undefined
      }
    >
      {authLoading ? (
        <div className="flex min-h-48 items-center justify-center text-slate-400">
          <Loader2 className="h-7 w-7 animate-spin" />
        </div>
      ) : !authUser ? (
        <section className="flex flex-col gap-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between md:p-8">
          <div className="flex min-w-0 gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
              <Inbox className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {t('community.signedOut.title')}
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                {t('community.signedOut.description')}
              </p>
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 dark:text-brand-300">
                <LockKeyhole className="h-3.5 w-3.5" />
                {t('community.privateNotice')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={presenter.community.openComposer}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
          >
            <MessageSquarePlus className="h-4 w-4" />
            {t('community.signedOut.action')}
          </button>
        </section>
      ) : (
        <>
          {composerOpen && <FeedbackComposer />}

          <section className="space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {t(isAdmin ? 'community.adminInbox.title' : 'community.myFeedback.title')}
                </h2>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {total}
                </span>
              </div>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                {t(
                  isAdmin
                    ? 'community.adminInbox.description'
                    : 'community.myFeedback.description'
                )}
              </p>
            </div>

            {isAdmin && (
              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1 md:pb-0">
                  <SlidersHorizontal className="h-4 w-4 shrink-0 text-slate-400" />
                  {CATEGORY_FILTERS.map((category) => (
                    <button
                      key={category ?? 'all'}
                      type="button"
                      onClick={() => actions.setCategoryFilter(category)}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        categoryFilter === category
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                      }`}
                    >
                      {category ? t(`community.categories.${category}`) : t('common.all')}
                    </button>
                  ))}
                </div>
                <select
                  value={statusFilter ?? ''}
                  onChange={(event) =>
                    actions.setStatusFilter(
                      (event.target.value || null) as FeedbackStatus | null
                    )
                  }
                  aria-label={t('community.filterStatus')}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="">{t('community.allStatuses')}</option>
                  {STATUS_FILTERS.slice(1).map((status) => (
                    <option key={status} value={status ?? ''}>
                      {status ? t(`community.statuses.${status}`) : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {isLoading && posts.length === 0 ? (
              <div className="flex min-h-48 items-center justify-center text-slate-400">
                <Loader2 className="h-7 w-7 animate-spin" />
              </div>
            ) : error ? (
              <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-red-200 bg-red-50/50 px-6 text-center dark:border-red-500/20 dark:bg-red-500/5">
                <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
                <button
                  type="button"
                  onClick={() => void presenter.community.loadPosts()}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-200"
                >
                  <RotateCcw className="h-4 w-4" />
                  {t('common.retry')}
                </button>
              </div>
            ) : posts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-900/60">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t(isAdmin ? 'community.adminInbox.empty' : 'community.myFeedback.empty')}
                </p>
                {!isAdmin && (
                  <button
                    type="button"
                    onClick={presenter.community.openComposer}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
                  >
                    <MessageSquarePlus className="h-4 w-4" />
                    {t('community.newFeedback')}
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {posts.map((post) => (
                  <FeedbackCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </PageLayout>
  );
};
