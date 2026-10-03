import type { ComponentPropsWithRef, ReactNode } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { Slot } from '@radix-ui/react-slot';

export const TooltipProvider = ({ children }: { children: ReactNode }) => (
  <TooltipPrimitive.Provider delayDuration={300} skipDelayDuration={300}>
    {children}
  </TooltipPrimitive.Provider>
);

export const Tooltip = ({ children, label, side = 'top' }: {
  children: ReactNode;
  label: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}) => (
  <TooltipPrimitive.Root>
    <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        side={side}
        sideOffset={6}
        collisionPadding={8}
        hideWhenDetached
        className="z-[200] max-w-[min(18rem,calc(100vw-1rem))] rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium leading-relaxed text-white shadow-lg dark:bg-slate-100 dark:text-slate-900"
      >
        {label}
        <TooltipPrimitive.Arrow className="fill-slate-900 dark:fill-slate-100" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  </TooltipPrimitive.Root>
);

const sizes = {
  xs: 'h-6 min-w-6 px-1',
  sm: 'h-8 min-w-8 px-2',
  md: 'h-9 min-w-9 px-2.5',
  lg: 'h-11 min-w-11 px-3',
  auto: '',
};

type IconButtonProps = Omit<ComponentPropsWithRef<'button'>, 'title' | 'aria-label'> & {
  /** Required accessible action name; always displayed in the tooltip. */
  label: string;
  tooltip?: string;
  size?: keyof typeof sizes;
  variant?: 'ghost' | 'plain';
  tooltipSide?: 'top' | 'right' | 'bottom' | 'left';
  asChild?: boolean;
};

/** Icon actions share naming, keyboard focus and tooltip behavior. */
export const IconButton = ({
  label, tooltip, size = 'md', variant = 'ghost', tooltipSide, asChild = false,
  className = '', type = 'button', children, ...props
}: IconButtonProps) => {
  const Component = asChild ? Slot : 'button';
  return (
    <Tooltip label={tooltip ? `${label} · ${tooltip}` : label} side={tooltipSide}>
      <Component
        {...props}
        {...(!asChild ? { type } : {})}
        aria-label={label}
        data-icon-button=""
        className={`inline-flex shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-40 ${variant === 'ghost' ? 'hover:bg-slate-100 active:bg-slate-200 dark:hover:bg-slate-800 dark:active:bg-slate-700' : ''} ${sizes[size]} ${className}`}
      >
        {children}
      </Component>
    </Tooltip>
  );
};
