import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Moon, Bell } from 'lucide-react';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { usePresenter } from '@/contexts/presenter-context';
import type { NotificationPreferences } from '@gemigo/notifications';
export function NotificationSettings() {
  const { t } = useTranslation();
  const presenter = usePresenter();
  const manager = presenter.notifications;
  const user = useAuthStore((s) => s.user);
  const deviceEnabled = useStore(manager.store, (s) => s.deviceEnabled);
  const prefs = useStore(manager.store, (s) => s.prefs);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!user) return;
    setError(null);
    void manager.loadPreferences().catch((e) => setError(String(e.message)));
  }, [manager, user]);
  const save = async (patch: Partial<NotificationPreferences>, resumeAutomatic = false) => {
    setBusy(true);
    setError(null);
    try {
      await manager.savePreferences(patch, resumeAutomatic);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('notifications.error'));
    } finally {
      setBusy(false);
    }
  };
  if (!user)
    return (
      <div className="p-8 text-center">
        <button
          onClick={() => presenter.auth.openAuthModal('login')}
          className="min-h-11 rounded-xl bg-brand-600 px-5 text-white"
        >
          {t('notifications.signIn')}
        </button>
      </div>
    );
  if (!prefs)
    return (
      <div className="p-8" role="status">
        {error || t('common.loading')}
      </div>
    );
  return (
    <main className="mx-auto max-w-2xl space-y-8 px-4 py-8 sm:px-8">
      <Link
        to="/notifications"
        className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-500"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('notifications.title')}
      </Link>
      <div>
        <h1 className="text-3xl font-semibold">{t('notifications.settings')}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">{t('notifications.settingsHint')}</p>
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}
      {prefs.reducedCategories.length > 0 && (
        <div className="rounded-xl bg-brand-50 p-4 text-sm dark:bg-brand-950">
          <p>{t('notifications.reducedHint')}</p>
          <button
            disabled={busy}
            onClick={() => void save({ pausedUntil: 0 }, true)}
            className="mt-2 min-h-11 text-brand-600 dark:text-brand-300"
          >
            {t('notifications.resume')}
          </button>
        </div>
      )}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 font-semibold">{t('notifications.inAppBadges')}</h2>
        {Object.entries(prefs.badges).map(([key, value]) => (
          <label
            key={key}
            className="flex min-h-12 items-center justify-between gap-4 border-b border-slate-100 text-sm last:border-0 dark:border-slate-800"
          >
            <span>{t('notifications.categories.' + key)}</span>
            <input
              type="checkbox"
              checked={value}
              disabled={busy}
              onChange={(e) => void save({ badges: { ...prefs.badges, [key]: e.target.checked } })}
              className="h-4 w-4 accent-brand-600"
            />
          </label>
        ))}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <Bell className="h-4 w-4" />
          {t('notifications.external')}
        </h2>
        <p className="mb-4 text-sm leading-6 text-slate-500">
          {t(
            prefs.pushAvailable
              ? 'notifications.deviceConsentNeeded'
              : 'notifications.deviceUnavailable'
          )}
        </p>
        <div className="mb-4 flex flex-wrap gap-3">
          <button
            disabled={busy || !prefs.pushAvailable || deviceEnabled}
            onClick={() => {
              setBusy(true);
              void manager
                .enableDevice()
                .catch((e) => setError(String(e.message)))
                .finally(() => setBusy(false));
            }}
            className="min-h-11 rounded-xl bg-brand-600 px-4 text-sm text-white disabled:opacity-40"
          >
            {t(deviceEnabled ? 'notifications.deviceEnabled' : 'notifications.enableDevice')}
          </button>
          <button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void manager
                .disableDevice()
                .catch((e) => setError(String(e.message)))
                .finally(() => setBusy(false));
            }}
            className="min-h-11 px-3 text-sm text-slate-600 dark:text-slate-300"
          >
            {t('notifications.disableDevice')}
          </button>
        </div>
        {Object.entries(prefs.external).map(([key, value]) => (
          <label key={key} className="flex min-h-12 items-center justify-between gap-4 text-sm">
            <span>{t('notifications.externalTypes.' + key)}</span>
            <input
              type="checkbox"
              checked={value}
              disabled={busy || !prefs.pushAvailable || !deviceEnabled}
              onChange={(e) =>
                void save({ external: { ...prefs.external, [key]: e.target.checked } })
              }
              className="h-4 w-4 accent-brand-600"
            />
          </label>
        ))}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <Moon className="h-4 w-4" />
          {t('notifications.quiet')}
        </h2>
        <p className="text-sm leading-6 text-slate-500">{t('notifications.quietHint')}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            const minutes = (v: FormDataEntryValue | null) =>
              String(v)
                .split(':')
                .reduce((n, part, index) => n + Number(part) * (index === 0 ? 60 : 1), 0);
            void save({
              timezone: String(data.get('timezone')),
              quietStart: minutes(data.get('start')),
              quietEnd: minutes(data.get('end')),
            });
          }}
          className="mt-4 space-y-4"
        >
          <label className="block text-sm">
            {t('notifications.timezone')}
            <input
              name="timezone"
              defaultValue={prefs.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
              className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-transparent px-3 dark:border-slate-700"
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            {[
              ['start', prefs.quietStart],
              ['end', prefs.quietEnd],
            ].map(([key, value]) => (
              <label key={String(key)} className="text-sm">
                {t('notifications.' + key)}
                <input
                  type="time"
                  name={String(key)}
                  defaultValue={
                    String(Math.floor(Number(value) / 60)).padStart(2, '0') +
                    ':' +
                    String(Number(value) % 60).padStart(2, '0')
                  }
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-transparent px-3 dark:border-slate-700"
                />
              </label>
            ))}
          </div>
          <button
            disabled={busy}
            className="min-h-11 rounded-xl bg-brand-600 px-5 text-sm text-white"
          >
            {t('common.save')}
          </button>
        </form>
        <div className="mt-5 flex flex-wrap gap-3">
          {[1, 7].map((days) => (
            <button
              key={days}
              disabled={busy}
              onClick={() => void save({ pausedUntil: Date.now() + days * 86400000 })}
              className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-700"
            >
              {t('notifications.pauseDays', { count: days })}
            </button>
          ))}
          <button
            disabled={busy}
            onClick={() => void save({ pausedUntil: 0 })}
            className="min-h-11 px-2 text-sm text-brand-600"
          >
            {t('notifications.resume')}
          </button>
        </div>
        {prefs.pausedUntil > Date.now() && (
          <p className="mt-3 text-xs text-slate-500">
            {t('notifications.pausedUntil', { time: new Date(prefs.pausedUntil).toLocaleString() })}
          </p>
        )}
      </section>
    </main>
  );
}
