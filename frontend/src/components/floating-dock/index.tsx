import type { ComponentProps, CSSProperties, ReactNode, Ref } from 'react';
import { IconButton } from '@/components/icon-button';
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
        className={`group/dock flex w-full flex-col items-center overflow-hidden border border-slate-200/60 bg-white/90 shadow-[0_4px_16px_rgba(0,0,0,0.1)] backdrop-blur-xl transition-all duration-300 ease-out dark:border-slate-700/60 dark:bg-slate-900/90 ${dockSide === 'inside-left' ? 'rounded-r-xl rounded-l-none border-l-0' : 'rounded-l-xl rounded-r-none border-r-0'}`}
      >
        {handle}
        <div
          id={actionAreaId}
          data-floating-dock-actions
          className={`flex w-full flex-col items-center gap-1 px-1 transition-all duration-300 ease-in-out origin-top ${isDragging || expanded ? 'max-h-[340px] pb-2 opacity-100 visible' : 'max-h-0 opacity-0 pb-0 invisible group-hover/dock:max-h-[340px] group-hover/dock:pb-2 group-hover/dock:opacity-100 group-hover/dock:visible group-focus-within/dock:max-h-[340px] group-focus-within/dock:pb-2 group-focus-within/dock:opacity-100 group-focus-within/dock:visible'}`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

type FloatingDockActionProps = Omit<
  ComponentProps<typeof IconButton>,
  'size' | 'tooltipSide' | 'onMouseDown'
>;

/** Every dock action uses the same hit area, feedback, tooltip and focus behavior. */
export function FloatingDockAction({ className = '', ...props }: FloatingDockActionProps) {
  return (
    <IconButton
      {...props}
      size="sm"
      tooltipSide="right"
      onMouseDown={(event) => event.stopPropagation()}
      className={`h-8 w-8 [&_svg]:h-4 [&_svg]:w-4 rounded-md text-slate-500 transition-colors hover:bg-brand-50 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800 ${className}`}
    />
  );
}

export function FloatingDockDivider() {
  return <div role="separator" className="h-px w-3 bg-slate-200 dark:bg-slate-700" />;
}

/** The optional leading control shares the same naming and tooltip primitive. */
export function FloatingDockHandle({
  className = '',
  ...props
}: Omit<ComponentProps<typeof IconButton>, 'size' | 'tooltipSide'>) {
  return (
    <IconButton
      {...props}
      size="auto"
      tooltipSide="right"
      className={`w-10 h-10 flex items-center justify-center flex-shrink-0 relative z-20 cursor-grab [&_svg]:h-5 [&_svg]:w-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 ${className}`}
    />
  );
}
