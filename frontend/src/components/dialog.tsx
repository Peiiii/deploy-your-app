import { useRef, type ComponentProps } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { IconButton } from './icon-button';

export const Dialog = DialogPrimitive.Root;

type DialogContentProps = ComponentProps<typeof DialogPrimitive.Content> & {
  closeLabel: string;
  dismissible?: boolean;
  size?: 'sm' | 'md';
};

/** Shared modal shell; callers own open state and the meaning of cancellation. */
export const DialogContent = ({
  children,
  className = '',
  closeLabel,
  dismissible = true,
  size = 'md',
  onEscapeKeyDown,
  onPointerDownOutside,
  onInteractOutside,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: DialogContentProps) => {
  const returnFocus = useRef<HTMLElement | null>(null);
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm motion-safe:animate-fade-in" />
      <DialogPrimitive.Content
        className={`fixed left-1/2 top-1/2 z-[100] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 ${size === 'sm' ? 'max-w-sm' : 'max-w-md'} ${className}`}
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
        <IconButton asChild label={closeLabel} size="auto">
          <DialogPrimitive.Close
            disabled={!dismissible}
            className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-40 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </DialogPrimitive.Close>
        </IconButton>
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
