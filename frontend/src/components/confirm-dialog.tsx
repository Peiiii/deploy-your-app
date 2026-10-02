import React, { useRef } from 'react';
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
  const cancelRef = useRef<HTMLButtonElement>(null);
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
      <DialogContent size="sm" closeLabel={t('common.close')} onOpenAutoFocus={(event) => { event.preventDefault(); cancelRef.current?.focus(); }}>
        <DialogHeader>
          <DialogTitle>{title || t('common.confirm')}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button
            type="button"
            ref={cancelRef}
            onClick={handleSecondary}
            className="btn-secondary"
          >
            {secondaryLabel}
          </button>
          <button
            type="button"
            onClick={handlePrimary}
            className="btn-primary"
          >
            {primaryLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
