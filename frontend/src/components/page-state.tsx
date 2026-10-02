import type { ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';

export const PageState = ({ title, description, action, children }: {
  title: string;
  description?: string;
  action?: ReactNode;
  children?: ReactNode;
}) => (
  <section className="surface-card flex min-h-60 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
    <CircleAlert aria-hidden="true" className="h-6 w-6 text-app-muted" />
    <h2 className="text-base font-semibold text-app-text">{title}</h2>
    {description && <p className="max-w-md text-sm leading-6 text-app-muted">{description}</p>}
    {action && <div className="mt-2">{action}</div>}
    {children}
  </section>
);
