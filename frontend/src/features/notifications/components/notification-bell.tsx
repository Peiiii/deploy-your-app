import { useStore } from 'zustand';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePresenter } from '@/contexts/presenter-context';
import { useAuthStore } from '@/features/auth/stores/auth.store';
export function NotificationBell() {
  const { t } = useTranslation();
  const manager = usePresenter().notifications;
  const id = useAuthStore((s) => s.user?.id ?? null);
  const ready = useStore(manager.store, (s) => s.summaryReady);
  const summary = useStore(manager.store, (s) => s.summary);
  if (!id) return null;
  return (
    <Link
      to="/notifications"
      aria-label={
        ready
          ? t('notifications.bellLabel', { count: summary.important })
          : t('notifications.title')
      }
      title={
        summary.important
          ? t('notifications.bellLabel', { count: summary.important })
          : t(summary.ordinary ? 'notifications.newActivity' : 'notifications.title')
      }
      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-slate-400 dark:hover:bg-slate-800"
    >
      <Bell className="h-5 w-5" />
      {summary.important > 0 ? (
        <span className="absolute right-0 top-0 min-w-4 rounded-full bg-brand-600 px-1 text-center text-[10px] font-semibold leading-4 text-white">
          {summary.important > 99 ? '99+' : summary.important}
        </span>
      ) : summary.ordinary > 0 ? (
        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand-500" />
      ) : null}
    </Link>
  );
}
