import { notificationReceipt } from '@/features/notifications/managers/notifications.manager';
import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { Link, useSearchParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { usePresenter } from '@/contexts/presenter-context';
import { LibraryManager } from '../managers/library.manager';
export function LibraryPage() {
  const [query] = useSearchParams();
  const location = useLocation();
  const kind = query.get('tab') ?? 'favorites';
  const [manager] = useState(() => new LibraryManager());
  const state = useStore(manager.store);
  const user = useAuthStore((s) => s.user);
  const presenter = usePresenter();
  const { t } = useTranslation();
  useEffect(() => {
    let active = true;
    if (user)
      void manager.load(kind).then((success) => {
        if (!success || !active) return;
        const receipt = notificationReceipt(location.state, query);
        if (receipt)
          void presenter.notifications
            .read(receipt.groupKey, receipt.throughSeq)
            .catch(() => undefined);
      });
    return () => {
      active = false;
      manager.dispose();
    };
  }, [manager, kind, user, location.state, query, presenter]);
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-8">
      <h1 className="text-3xl font-semibold">{t('notifications.library.' + kind)}</h1>
      <nav className="flex flex-wrap gap-3 text-sm">
        <Link
          to="/me"
          className="min-h-11 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-700"
        >
          {t('navigation.profile')}
        </Link>
        {['favorites', 'following', 'publications'].map((tab) => (
          <Link
            key={tab}
            to={'/me?tab=' + tab}
            className={`min-h-11 rounded-xl px-4 py-3 ${kind === tab ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}
          >
            {t('notifications.library.' + tab)}
          </Link>
        ))}
      </nav>
      {!user ? (
        <button
          onClick={() => presenter.auth.openAuthModal('login')}
          className="rounded-xl bg-brand-600 px-5 py-3 text-white"
        >
          {t('notifications.signIn')}
        </button>
      ) : (
        <>
          {state.error && (
            <p role="alert" className="text-red-600">
              {state.error}
              <button onClick={() => void manager.load(kind)} className="ml-3 underline">
                {t('common.retry')}
              </button>
            </p>
          )}
          {state.loading && <p role="status">{t('common.loading')}</p>}
          {!state.loading && !state.items.length && !state.error && (
            <p className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-500 dark:border-slate-700">
              {t('notifications.libraryEmpty')}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {state.items.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
              >
                {kind === 'following' || kind === 'followers' ? (
                  <>
                    <Link
                      to={'/u/' + encodeURIComponent(item.handle || item.id)}
                      className="text-lg font-semibold"
                    >
                      {item.display_name || item.handle || t('notifications.someone')}
                    </Link>
                    {kind === 'following' && (
                      <button
                        onClick={async () => {
                          try {
                            await manager.unfollow(item.handle || item.id);
                          } catch (e) {
                            presenter.ui.showErrorToast(
                              e instanceof Error ? e.message : t('notifications.error')
                            );
                          }
                        }}
                        className="mt-4 block min-h-11 text-sm text-slate-500"
                      >
                        {t('notifications.unfollow')}
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <h2 className="text-lg font-semibold">{item.name}</h2>
                    {item.description && (
                      <p className="mt-2 line-clamp-2 text-sm text-slate-500">{item.description}</p>
                    )}
                    <div className="mt-4 flex gap-4 text-sm">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-600"
                      >
                        {t('notifications.openApp')}
                      </a>
                      <Link to={'/apps/' + item.id + '/discussion'} className="text-slate-500">
                        {t('notifications.discussion')}
                      </Link>
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
          {state.cursor && (
            <button
              disabled={state.loading}
              onClick={() => void manager.load(kind, true)}
              className="min-h-11 w-full rounded-xl border border-slate-200 text-sm dark:border-slate-700"
            >
              {t('explore.loadMore')}
            </button>
          )}
        </>
      )}
    </main>
  );
}
