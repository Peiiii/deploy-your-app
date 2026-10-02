import React, { type ReactNode } from 'react';
import { useLayoutMode } from '@/hooks/use-layout-mode';

export interface PageLayoutProps {
    title: ReactNode;
    children: ReactNode;
    actions?: ReactNode;
}

export const PageLayout: React.FC<PageLayoutProps> = ({
    title,
    children,
    actions,
}) => {
    const { isCompact } = useLayoutMode();

    return (
        <div className="page-layout flex min-h-full min-w-0 flex-col bg-app-bg">
            {/* Header */}
            <header className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-5 pb-6 pt-7 md:px-8 md:pt-8">
                <div className="flex items-center gap-4 min-w-0">
                    <h1 className={`${isCompact ? 'text-xl' : 'text-2xl'} font-semibold text-app-text tracking-tight`}>
                        {title}
                    </h1>
                </div>
                {actions && <div className="flex items-center gap-3">{actions}</div>}
            </header>

            {/* Content Area */}
            <div className="flex-1">
                <div className={`max-w-7xl mx-auto ${isCompact ? 'px-5' : 'px-5 md:px-8'} pb-10 space-y-7`}>
                    {children}
                </div>
            </div>
        </div>
    );
};
