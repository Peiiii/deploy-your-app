import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';
import { useUIStore } from '../stores/ui.store';
import { confirmController } from '../services/confirm-controller';

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
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) handleSecondary();
      }}
    >
      <DialogContent size="sm" closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{title || t('common.confirm')}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
