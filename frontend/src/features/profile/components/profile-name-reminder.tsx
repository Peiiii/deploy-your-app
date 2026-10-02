import { useTranslation } from 'react-i18next';
import { UserRoundPen, X } from 'lucide-react';
import { normalizePublicHandle, normalizePublicLabel } from '@gemigo/public-author';
import { usePresenter } from '@/contexts/presenter-context';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { useProfileNameStore } from '@/features/profile/stores/profile-name.store';

export const ProfileNameReminder = () => {
  const { t } = useTranslation();
  const presenter = usePresenter();
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const draft = useProfileNameStore();

  if (isLoading || !user || normalizePublicLabel(user.displayName) ||
      normalizePublicHandle(user.handle) || draft.dismissedUserIds.includes(user.id)) return null;

  const editing = draft.editingUserId === user.id;
  const dismiss = () => presenter.myProfile.dismissNameReminder();

  return (
    <section aria-label={t('profile.nameReminderTitle')} className="mx-4 my-3 rounded-2xl border border-brand-200 bg-brand-50/70 p-4 dark:border-brand-500/30 dark:bg-brand-500/10 md:mx-8">
      <div className="flex items-start gap-3">
        <UserRoundPen className="mt-0.5 h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('profile.nameReminderTitle')}</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{t('profile.nameReminderDescription')}</p>
          {!editing && (
            <button type="button" onClick={presenter.myProfile.beginNameSetup} className="mt-3 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700">
              {t('profile.setName')}
            </button>
          )}
        </div>
        <button type="button" onClick={dismiss} disabled={editing && draft.isSaving} aria-label={t('profile.nameReminderLater')} className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-brand-100 disabled:opacity-50 dark:hover:bg-brand-500/20">
          <X className="h-4 w-4" />
        </button>
      </div>
      {editing && (
        <form className="mt-4 max-w-xl space-y-3" onSubmit={(event) => { event.preventDefault(); void presenter.myProfile.savePublicName(); }}>
          <div>
            <label htmlFor="reminder-display-name" className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">{t('profile.displayNameLabel')}</label>
            <input id="reminder-display-name" name="nickname" autoFocus required maxLength={50} value={draft.displayName} disabled={draft.isSaving} onChange={(event) => useProfileNameStore.setState({ displayName: event.target.value, error: null })} placeholder={t('profile.displayNamePlaceholder')} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('profile.displayNameHint')}</p>
          </div>
          <div>
            <label htmlFor="reminder-handle" className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">{t('profile.optionalHandleLabel')}</label>
            <input id="reminder-handle" name="username" autoCapitalize="none" autoCorrect="off" maxLength={24} value={draft.handle} disabled={draft.isSaving} onChange={(event) => useProfileNameStore.setState({ handle: event.target.value, error: null })} placeholder={t('profile.handlePlaceholder')} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('profile.handleUniquenessHint')}</p>
          </div>
          {draft.error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{draft.error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={draft.isSaving} className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{draft.isSaving ? t('common.loading') : t('profile.saveName')}</button>
            <button type="button" onClick={dismiss} disabled={draft.isSaving} className="rounded-lg px-3 py-2 text-xs text-slate-600 hover:bg-brand-100 disabled:opacity-60 dark:text-slate-300 dark:hover:bg-brand-500/20">{t('profile.nameReminderLater')}</button>
          </div>
        </form>
      )}
    </section>
  );
};
