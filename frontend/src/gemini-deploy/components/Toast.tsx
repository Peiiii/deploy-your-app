import React, { useEffect } from 'react';
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';
import { useUIStore } from '../stores/uiStore';

export const Toast: React.FC = () => {
  const toast = useUIStore((s) => s.toast);
  const clearToast = useUIStore((s) => s.actions.clearToast);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      clearToast();
    }, 3000);
    return () => clearTimeout(timer);
  }, [toast, clearToast]);

  if (!toast) return null;

  const isSuccess = toast.variant === 'success';
  const isError = toast.variant === 'error';

  const Icon = isSuccess ? CheckCircle2 : isError ? AlertTriangle : Info;

  const baseClasses =
    'fixed bottom-4 right-4 z-50 max-w-sm rounded-xl shadow-lg px-4 py-3 flex items-start gap-2 text-xs';
  const colorClasses = isSuccess
    ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800/80'
    : isError
      ? 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800/80'
      : 'bg-slate-900 text-slate-100 border border-slate-800';

  return (
    <div className={`${baseClasses} ${colorClasses}`}>
      <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <div className="flex-1">{toast.message}</div>
      <button
        type="button"
        onClick={clearToast}
        className="ml-2 text-current opacity-60 hover:opacity-100"
        aria-label="Close notification"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
};

