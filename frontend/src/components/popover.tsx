import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { IconButton } from './icon-button';

interface PopoverProps {
  trigger: ReactNode;
  triggerClassName: string;
  triggerLabel: string;
  className?: string;
  panelClassName: string;
  children: ReactNode | ((close: () => void) => ReactNode);
}

export const Popover = ({
  trigger,
  triggerClassName,
  triggerLabel,
  className = 'relative',
  panelClassName,
  children,
}: PopoverProps) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside, true);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside, true);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={className}
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) close();
      }}
    >
      <IconButton label={triggerLabel} showTooltip={false} size="auto"
        ref={triggerRef}
        type="button"
        className={`group ${triggerClassName}`}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        {trigger}
      </IconButton>
      {open && (
        <div id={panelId} className={panelClassName}>
          {typeof children === 'function' ? children(close) : children}
        </div>
      )}
    </div>
  );
};
