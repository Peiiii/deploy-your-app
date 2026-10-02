import { useRef, type ComponentProps } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

export const Dialog = DialogPrimitive.Root;

type DialogContentProps = ComponentProps<typeof DialogPrimitive.Content> & {
  closeLabel: string;
  dismissible?: boolean;
  size?: 'sm' | 'md';
  layout?: 'modal' | 'drawer' | 'fullscreen';
  showClose?: boolean;
};

/** Shared modal shell; callers own open state and the meaning of cancellation. */
export const DialogContent = ({
  children,
  className = '',
  closeLabel,
  dismissible = true,
  size = 'md',
  layout = 'modal',
  showClose = true,
  onEscapeKeyDown,
  onPointerDownOutside,
  onInteractOutside,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: DialogContentProps) => {
  const returnFocus = useRef<HTMLElement | null>(null);
  const geometry = layout === 'drawer'
    ? 'inset-y-0 left-0 h-[100dvh] w-64 overflow-y-auto'
    : layout === 'fullscreen'
      ? 'inset-0 h-[100dvh] w-full overflow-hidden'
      : `left-1/2 top-1/2 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-app-border p-6 shadow-xl ${size === 'sm' ? 'max-w-sm' : 'max-w-md'}`;
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/35" />
      <DialogPrimitive.Content
        className={`fixed z-[100] bg-app-bg text-app-text focus:outline-none ${geometry} ${className}`}
        onOpenAutoFocus={(event) => {
          // App dialogs also open from managers, without a Radix DialogTrigger.
          returnFocus.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
          onOpenAutoFocus?.(event);
        }}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          if (!event.defaultPrevented) {
            event.preventDefault();
            if (returnFocus.current?.isConnected) returnFocus.current.focus();
          }
        }}
        onEscapeKeyDown={(event) => {
          onEscapeKeyDown?.(event);
          if (!dismissible) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          onPointerDownOutside?.(event);
          if (!dismissible) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          onInteractOutside?.(event);
          if (!dismissible) event.preventDefault();
        }}
        {...props}
      >
        {children}
        {showClose && <DialogPrimitive.Close
          disabled={!dismissible}
          aria-label={closeLabel}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </DialogPrimitive.Close>}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
};

export const DialogHeader = ({ className = '', ...props }: ComponentProps<'div'>) => (
  <div className={`mb-6 space-y-2 pr-6 ${className}`} {...props} />
);

export const DialogTitle = ({
  className = '',
  ...props
}: ComponentProps<typeof DialogPrimitive.Title>) => (
  <DialogPrimitive.Title
    className={`text-lg font-semibold tracking-tight ${className}`}
    {...props}
  />
);

export const DialogDescription = ({
  className = '',
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) => (
  <DialogPrimitive.Description
    className={`text-sm leading-relaxed text-slate-500 dark:text-slate-400 ${className}`}
    {...props}
  />
);

export const DialogFooter = ({ className = '', ...props }: ComponentProps<'div'>) => (
  <div
    className={`flex flex-col-reverse gap-2 sm:flex-row sm:justify-end ${className}`}
    {...props}
  />
);
