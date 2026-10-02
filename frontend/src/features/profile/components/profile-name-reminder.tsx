import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { UserRoundPen } from 'lucide-react';
import { normalizePublicHandle, normalizePublicLabel } from '@gemigo/public-author';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/dialog';
import { usePresenter } from '@/contexts/presenter-context';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { useProfileNameStore } from '@/features/profile/stores/profile-name.store';
import { useUIStore } from '@/stores/ui.store';

export const ProfileNameReminder = () => {
  const { t } = useTranslation();
  const presenter = usePresenter();
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const authModalOpen = useAuthStore((s) => s.modalOpen);
  const confirmDialog = useUIStore((s) => s.confirmDialog);
  const draft = useProfileNameStore();
  const shouldRemind = Boolean(
    !isLoading &&
    user &&
    !normalizePublicLabel(user.displayName) &&
    !normalizePublicHandle(user.handle) &&
    !draft.dismissedUserIds.includes(user.id)
  );
  const blocked = authModalOpen || Boolean(confirmDialog);

  useEffect(() => {
    if (shouldRemind && !blocked && draft.editingUserId !== user?.id) {
      presenter.myProfile.beginNameSetup();
    }
  }, [shouldRemind, blocked, draft.editingUserId, user?.id, presenter]);

  if (!shouldRemind || blocked || !user) return null;

  const dismiss = () => presenter.myProfile.dismissNameReminder();

  return (
    <Dialog
      open={draft.editingUserId === user.id}
      onOpenChange={(open) => {
        if (!open) dismiss();
      }}
    >
      <DialogContent closeLabel={t('profile.nameReminderLater')} dismissible={!draft.isSaving}>
        <DialogHeader>
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <UserRoundPen className="h-5 w-5" aria-hidden="true" />
          </div>
          <DialogTitle>{t('profile.nameReminderTitle')}</DialogTitle>
          <DialogDescription>{t('profile.nameReminderDescription')}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            void presenter.myProfile.savePublicName();
          }}
        >
          <div>
            <label htmlFor="reminder-display-name" className="mb-2 block text-sm font-medium">
              {t('profile.displayNameLabel')}
            </label>
            <input
              id="reminder-display-name"
              name="nickname"
              required
              maxLength={50}
              aria-describedby="reminder-display-name-hint"
              value={draft.displayName}
              disabled={draft.isSaving}
              onChange={(event) =>
                useProfileNameStore.setState({ displayName: event.target.value, error: null })
              }
              placeholder={t('profile.displayNamePlaceholder')}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800"
            />
            <p
              id="reminder-display-name-hint"
              className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400"
            >
              {t('profile.displayNameHint')}
            </p>
          </div>
          <div>
            <label htmlFor="reminder-handle" className="mb-2 block text-sm font-medium">
              {t('profile.optionalHandleLabel')}
            </label>
            <input
              id="reminder-handle"
              name="username"
              autoCapitalize="none"
              autoCorrect="off"
              maxLength={24}
              aria-describedby="reminder-handle-hint"
              value={draft.handle}
              disabled={draft.isSaving}
              onChange={(event) =>
                useProfileNameStore.setState({ handle: event.target.value, error: null })
              }
              placeholder={t('profile.handlePlaceholder')}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800"
            />
            <p
              id="reminder-handle-hint"
              className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400"
            >
              {t('profile.handleUniquenessHint')}
            </p>
          </div>
          {draft.error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {draft.error}
            </p>
          )}
          <DialogFooter className="pt-1">
            <button
              type="button"
              onClick={dismiss}
              disabled={draft.isSaving}
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {t('profile.nameReminderLater')}
            </button>
            <button
              type="submit"
              disabled={draft.isSaving}
              className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-60 dark:focus-visible:ring-offset-slate-900"
            >
              {draft.isSaving ? t('common.loading') : t('profile.saveName')}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
