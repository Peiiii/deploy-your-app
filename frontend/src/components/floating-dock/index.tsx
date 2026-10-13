import type { ComponentProps, CSSProperties, ReactNode, Ref, MouseEventHandler } from 'react';
import { IconButton, Tooltip } from '@/components/icon-button';
import type { DockSide } from './types';

interface FloatingDockProps {
  label: string;
  dockSide: DockSide;
  style: CSSProperties;
  nodeRef?: Ref<HTMLDivElement>;
  handle?: ReactNode;
  children: ReactNode;
  expanded?: boolean;
  isDragging?: boolean;
  actionAreaId?: string;
  /** Preserve smooth docking when no neighboring control requires immediate avoidance. */
  animatePosition?: boolean;
}

/** Shared geometry, surface, action layout and accessibility for floating controls. */
export function FloatingDock({
  label,
  dockSide,
  style,
  nodeRef,
  handle,
  children,
  expanded = true,
  isDragging = false,
  actionAreaId,
  animatePosition = false,
}: FloatingDockProps) {
  return (
    <div
      ref={nodeRef}
      style={style}
      role="toolbar"
      aria-label={label}
      aria-orientation="vertical"
      data-floating-dock
      className={`absolute z-50 w-[41px] select-none ${isDragging ? 'cursor-grabbing' : animatePosition ? 'transition-[left,top] duration-500 linear' : ''}`}
    >
      <div
        data-floating-dock-surface
        className={`group/dock flex w-full flex-col items-center overflow-hidden border border-slate-200/60 bg-white/90 shadow-[0_4px_16px_rgba(0,0,0,0.1)] backdrop-blur-xl transition-all duration-300 ease-[cubic-bezier(0.22,1.3,0.36,1)] motion-reduce:transition-none dark:border-slate-700/60 dark:bg-slate-900/90 ${isDragging ? 'rounded-2xl border-l border-r' : dockSide === 'inside-left' ? 'rounded-r-xl rounded-l-none border-l-0' : 'rounded-l-xl rounded-r-none border-r-0'}`}
      >
        {handle}
        <div
          id={actionAreaId}
          data-floating-dock-actions
          className={`flex w-full flex-col items-center gap-1 px-1 transition-all duration-300 ease-in-out origin-top ${isDragging || expanded ? 'max-h-[340px] py-1 opacity-100 visible' : 'max-h-0 opacity-0 py-0 invisible group-hover/dock:max-h-[340px] group-hover/dock:py-1 group-hover/dock:opacity-100 group-hover/dock:visible group-focus-within/dock:max-h-[340px] group-focus-within/dock:py-1 group-focus-within/dock:opacity-100 group-focus-within/dock:visible'}`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

type FloatingDockActionProps = Omit<
  ComponentProps<typeof IconButton>,
  'size' | 'tooltipSide' | 'onMouseDown' | 'variant'
> & { feedbackTone?: 'default' | 'danger' };

// Keep the feedback smaller than the hit area, including for the leading handle.
const feedbackClass =
  "relative before:pointer-events-none before:absolute before:left-1/2 before:top-1/2 before:h-6 before:w-6 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-md before:content-[''] before:transition-colors focus-visible:!ring-0 focus-visible:before:ring-1 focus-visible:before:ring-brand-500 [&_svg]:relative";
const defaultFeedbackClass =
  'enabled:hover:before:bg-brand-50 enabled:hover:text-brand-600 enabled:active:before:bg-brand-100 dark:enabled:hover:before:bg-slate-800 dark:enabled:active:before:bg-slate-700';

/** Every dock action uses the same hit area, feedback, tooltip and focus behavior. */
export function FloatingDockAction({
  className = '',
  feedbackTone = 'default',
  ...props
}: FloatingDockActionProps) {
  const selected = props['aria-expanded'] === true || props['aria-pressed'] === true;
  return (
    <IconButton
      {...props}
      variant="plain"
      size="sm"
      tooltipSide="right"
      onMouseDown={(event) => event.stopPropagation()}
      className={`h-8 w-8 [&_svg]:h-4 [&_svg]:w-4 text-slate-500 transition-colors disabled:opacity-40 dark:text-slate-400 ${feedbackClass} ${feedbackTone === 'danger' ? 'enabled:hover:before:bg-red-50 enabled:hover:text-red-600 enabled:active:before:bg-red-100 dark:enabled:hover:before:bg-red-950 dark:enabled:active:before:bg-red-900' : defaultFeedbackClass} ${selected ? 'before:bg-brand-50 text-brand-600 dark:before:bg-slate-800 dark:text-brand-400' : ''} ${className}`}
    />
  );
}

export function FloatingDockDivider() {
  return <div role="separator" className="h-px w-3 bg-slate-200 dark:bg-slate-700" />;
}

/** A passive identity marker; hover/focus may describe it, pressing never toggles actions. */
export function FloatingDockIdentity({
  label,
  children,
  onMouseDown,
}: {
  label: string;
  children: ReactNode;
  onMouseDown?: MouseEventHandler<HTMLDivElement>;
}) {
  return (
    <Tooltip label={label} side="right">
      <div
        role="img"
        aria-label={label}
        tabIndex={0}
        onMouseDown={onMouseDown}
        className={`w-10 h-10 flex shrink-0 items-center justify-center [&_svg]:h-5 [&_svg]:w-5 [&_img]:h-5 [&_img]:w-5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-brand-500 ${onMouseDown ? 'cursor-grab' : 'cursor-default'}`}
      >
        {children}
      </div>
    </Tooltip>
  );
}
