import React from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useUIStore } from '../stores/uiStore';
import { confirmController } from '../services/confirmController';

export const ConfirmDialog: React.FC = () => {
  const { t } = useTranslation();
  const confirmDialog = useUIStore((state) => state.confirmDialog);
  const actions = useUIStore((state) => state.actions);

  if (!confirmDialog) {
    return null;
  }

  const { title, message, primaryLabel, secondaryLabel } = confirmDialog;

  const handleClose = () => {
    actions.closeConfirmDialog();
  };

  const handlePrimary = () => {
    confirmController.resolve(true);
    handleClose();
  };

  const handleSecondary = () => {
    confirmController.resolve(false);
    handleClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {title || t('common.confirm')}
          </h2>
          <button
            onClick={handleSecondary}
            className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
            aria-label={t('common.close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 pt-4 pb-5 space-y-4">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            {message}
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleSecondary}
              className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              {secondaryLabel}
            </button>
            <button
              type="button"
              onClick={handlePrimary}
              className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 dark:bg-brand-500 dark:hover:bg-brand-400 transition-colors"
            >
              {primaryLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
