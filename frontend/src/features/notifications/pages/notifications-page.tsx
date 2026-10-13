import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  MessageCircle,
  Heart,
  Users,
  ArrowUpRight,
  Settings,
  CheckCheck,
  RefreshCw,
} from 'lucide-react';
import { usePresenter } from '@/contexts/presenter-context';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import type { NotificationItem, NotificationKind } from '@gemigo/notifications';

const actionKeys: Record<NotificationKind, string> = {
  comment: 'comment',
  reply: 'reply',
  like: 'like',
  favorite: 'favorite',
  follow: 'follow',
  feedback_reply: 'feedbackReply',
  feedback_status: 'feedbackStatus',
  deployment_success: 'deploymentSuccess',
  deployment_failure: 'deploymentFailure',
};
export function NotificationsPage() {
  const { t } = useTranslation();
  const presenter = usePresenter();
  const manager = presenter.notifications;
  const state = useStore(manager.store);
  const user = useAuthStore((s) => s.user);
  const [actionError, setActionError] = useState<string | null>(null);
  useEffect(() => {
    if (user) void manager.load();
  }, [manager, user]);
  const act = async (work: () => Promise<void>) => {
    setActionError(null);
    try {
      await work();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : t('notifications.error'));
    }
  };
  if (!user)
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <Bell className="mx-auto mb-5 h-10 w-10 text-brand-500" />
        <h1 className="text-2xl font-semibold">{t('notifications.title')}</h1>
        <p className="my-4 text-slate-500">{t('notifications.signIn')}</p>
        <button
          onClick={() => presenter.auth.openAuthModal('login')}
          className="rounded-xl bg-brand-600 px-5 py-3 text-white"
        >
          {t('common.signIn')}
        </button>
      </div>
    );
  const renderItem = (item: NotificationItem) => {
    const Icon =
      item.category === 'comments'
        ? MessageCircle
        : item.category === 'reactions'
          ? Heart
          : item.category === 'follows'
            ? Users
            : Bell;
    return (
      <article
        key={item.groupKey}
        className={`flex gap-4 border-b border-slate-100 px-4 py-5 last:border-0 dark:border-slate-800 sm:px-6 ${item.unread ? 'bg-brand-50/50 dark:bg-brand-950/20' : ''}`}
      >
        <div
          className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${item.important ? 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <Link
              to={item.target}
              state={{ notification: { groupKey: item.groupKey, throughSeq: item.throughSeq } }}
              className="inline-flex min-h-11 min-w-0 items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <p className={`break-words text-sm ${item.unread ? 'font-semibold' : 'font-medium'}`}>
                {t('notifications.actions.' + actionKeys[item.kind], {
                  name: item.actorName || t('notifications.someone'),
                  count: item.count,
                  title: item.title,
                })}
              </p>
            </Link>
            {item.unread && (
              <span
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500"
                aria-label={t('notifications.unread')}
              />
            )}
          </div>
          {item.excerpt && (
            <p className="mt-2 line-clamp-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-500 dark:text-slate-400">
              {item.excerpt}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            <time className="text-slate-400" dateTime={new Date(item.at).toISOString()}>
              {new Date(item.at).toLocaleString()}
            </time>
            <Link
              to={item.target}
              state={{ notification: { groupKey: item.groupKey, throughSeq: item.throughSeq } }}
              className="inline-flex min-h-11 items-center gap-1 font-medium text-brand-600 dark:text-brand-400"
            >
              {t(
                item.needsReply
                  ? 'notifications.viewReply'
                  : item.kind === 'reply'
                    ? 'notifications.viewReplyMessage'
                    : 'notifications.view'
              )}
              <ArrowUpRight className="h-3 w-3" />
            </Link>
            {item.unread && (
              <button
                onClick={() => void act(() => manager.read(item.groupKey, item.throughSeq))}
                className="min-h-11 text-slate-600 hover:text-slate-900 dark:text-slate-300"
              >
                {t('notifications.markRead')}
              </button>
            )}
            {item.kind !== 'follow' && (
              <button
                onClick={() => void act(() => manager.mute(item.subjectId, !item.muted))}
                className="min-h-11 text-slate-600 hover:text-slate-900 dark:text-slate-300"
              >
                {t(item.muted ? 'notifications.resumeSubject' : 'notifications.muteSubject')}
              </button>
            )}
            {item.needsReply && item.commentId && (
              <button
                onClick={() => void act(() => manager.dismiss(item.commentId!))}
                className="min-h-11 text-slate-600 dark:text-slate-300"
              >
                {t('notifications.noReplyNeeded')}
              </button>
            )}
          </div>
        </div>
      </article>
    );
  };
  const important = state.items.filter((item) => item.important),
    other = state.items.filter((item) => !item.important);
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand-600">
            {t('notifications.eyebrow')}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">{t('notifications.title')}</h1>
          <p className="mt-2 text-sm text-slate-500">{t('notifications.subtitle')}</p>
        </div>
        <Link
          to="/notifications/settings"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm dark:border-slate-700"
        >
          <Settings className="h-4 w-4" />
          {t('notifications.settings')}
        </Link>
      </header>
      <div
        className="flex gap-2 overflow-x-auto pb-1"
        role="group"
        aria-label={t('notifications.filters')}
      >
        {['all', 'comments', 'reactions', 'follows', 'system'].map((category) => (
          <button
            key={category}
            onClick={() => void manager.load(category, false)}
            className={`min-h-11 shrink-0 rounded-full px-4 text-sm ${state.category === category ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}
            aria-pressed={state.category === category}
          >
            {t('notifications.categories.' + category)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            checked={state.needsReply}
            onChange={(event) => void manager.load('comments', event.target.checked)}
            className="accent-brand-600"
          />
          {t('notifications.needsReply')}
        </label>
        <div className="flex gap-4">
          <button
            disabled={state.loading}
            onClick={() => void manager.load()}
            className="flex min-h-11 items-center gap-1 text-slate-500"
          >
            <RefreshCw className="h-4 w-4" />
            {t('notifications.refresh')}
          </button>
          <button
            disabled={state.loading || !state.items.length}
            onClick={() => void act(manager.readAll)}
            className="flex min-h-11 items-center gap-1 text-slate-500"
          >
            <CheckCheck className="h-4 w-4" />
            {t('notifications.markAllRead')}
          </button>
        </div>
      </div>
      {(state.error || actionError) && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {state.error || actionError}
          <button onClick={() => void manager.load()} className="ml-3 underline">
            {t('common.retry')}
          </button>
        </div>
      )}
      {state.loading && (
        <p role="status" className="py-6 text-center text-sm text-slate-500">
          {t('common.loading')}
        </p>
      )}
      {!state.loading && !state.error && !state.items.length && (
        <section className="rounded-2xl border border-dashed border-slate-200 py-14 text-center dark:border-slate-700">
          <Bell className="mx-auto mb-4 h-8 w-8 text-slate-300" />
          <h2 className="font-medium">
            {t(state.needsReply ? 'notifications.noPending' : 'notifications.empty')}
          </h2>
          <p className="mx-auto mt-2 max-w-sm px-4 text-sm leading-6 text-slate-500">
            {t('notifications.emptyHint')}
          </p>
          <Link
            to="/me?tab=favorites"
            className="mt-5 inline-block text-sm font-medium text-brand-600"
          >
            {t('notifications.myFavorites')}
          </Link>
        </section>
      )}
      {!!important.length && (
        <section>
          <h2 className="mb-3 text-xs font-semibold text-slate-500">
            {t('notifications.important')}
          </h2>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            {important.map(renderItem)}
          </div>
        </section>
      )}
      {!!other.length && (
        <section>
          <h2 className="mb-3 text-xs font-semibold text-slate-500">{t('notifications.other')}</h2>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            {other.map(renderItem)}
          </div>
        </section>
      )}
      {state.cursor && (
        <button
          disabled={state.loading}
          onClick={() => void manager.load(state.category, state.needsReply, true)}
          className="min-h-11 w-full rounded-xl border border-slate-200 text-sm dark:border-slate-700"
        >
          {t('explore.loadMore')}
        </button>
      )}
      <p className="text-center text-xs leading-5 text-slate-500">
        {t('notifications.retentionHint')}
      </p>
    </main>
  );
}
