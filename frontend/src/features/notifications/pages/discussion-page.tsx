import { notificationReceipt } from '@/features/notifications/managers/notifications.manager';
import { useEffect, useMemo } from 'react';
import { useStore } from 'zustand';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { usePresenter } from '@/contexts/presenter-context';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { PreviewCommentsPanel } from '@/features/home/components/preview-comments-panel';
import { DiscussionManager } from '../managers/discussion.manager';
export function DiscussionPage() {
  const { id = '' } = useParams();
  const [query] = useSearchParams();
  const commentId = query.get('commentId');
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const presenter = usePresenter();
  const { t } = useTranslation();
  const manager = useMemo(
    () =>
      new DiscussionManager(id, (force) => {
        if (!force && presenter.auth.getCurrentUser()) return true;
        presenter.auth.openAuthModal('login');
        return false;
      }),
    [id, presenter]
  );
  const state = useStore(manager.store);
  useEffect(() => {
    if (!user) return;
    let active = true;
    void manager.load(commentId).then(async (success) => {
      if (!success || !active) return;
      const receipt = notificationReceipt(location.state, query);
      if (receipt)
        await presenter.notifications
          .read(receipt.groupKey, receipt.throughSeq)
          .catch(() => undefined);
      if (commentId)
        setTimeout(() => {
          const target = document.getElementById('comment-' + commentId);
          target?.scrollIntoView({ block: 'center' });
          target?.classList.add('ring-2', 'ring-brand-400', 'rounded-lg');
          setTimeout(
            () => target?.classList.remove('ring-2', 'ring-brand-400', 'rounded-lg'),
            5000
          );
        }, 0);
    });
    return () => {
      active = false;
      manager.dispose();
    };
  }, [manager, commentId, user, location.state, query, presenter]);
  if (!user)
    return (
      <div className="p-8 text-center">
        <p>{t('notifications.signIn')}</p>
        <button
          onClick={() => presenter.auth.openAuthModal('login')}
          className="mt-4 rounded-xl bg-brand-600 px-5 py-3 text-white"
        >
          {t('common.signIn')}
        </button>
      </div>
    );
  return (
    <main className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 sm:px-8">
      <Link
        to="/notifications"
        className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-500"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('notifications.title')}
      </Link>
      {state.loading && <p role="status">{t('common.loading')}</p>}
      {state.error && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {state.error}
          <button onClick={() => void manager.load(commentId)} className="ml-3 underline">
            {t('common.retry')}
          </button>
        </p>
      )}
      {state.project && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold">{state.project.name}</h1>
            {state.project.url && (
              <a
                href={state.project.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 text-sm text-brand-600"
              >
                {t('notifications.openApp')}
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
          <div className="h-[calc(100dvh-240px)] min-h-[360px] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
            <PreviewCommentsPanel
              key={id}
              projectId={id}
              panelId={'discussion-' + id}
              open
              isFullscreen={false}
              appName={state.project.name}
              onClose={() => window.history.back()}
              manager={manager.comments}
            />
          </div>
        </>
      )}
    </main>
  );
}
