import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogTitle } from './dialog';

/** Viewport dialogs reuse the common focus, dismissal and restoration owner. */
export const Modal = ({ open, onClose, titleId, title, children, layout }: {
  open: boolean;
  onClose: () => void;
  titleId: string;
  title: string;
  children: ReactNode;
  layout: 'drawer' | 'fullscreen';
}) => {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent layout={layout} showClose={false} closeLabel={t('common.close')} aria-labelledby={titleId} aria-describedby={undefined}>
        <DialogTitle id={titleId} className="sr-only">{title}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
};
