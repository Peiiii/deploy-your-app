import React, { type ReactNode } from 'react';

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
    return (
        <div className="flex flex-col h-full bg-[#f8fafc] dark:bg-slate-900">
            {/* Header */}
            <header className="h-16 md:h-20 px-4 md:px-8 flex items-center justify-between sticky top-0 bg-[#f8fafc]/80 dark:bg-slate-900/80 backdrop-blur z-20 border-b border-slate-100 dark:border-slate-800/50">
                <div className="flex items-center gap-4 min-w-0">
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
                        {title}
                    </h1>
                </div>
                {actions && <div className="flex items-center gap-3">{actions}</div>}
            </header>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-7xl mx-auto p-3 md:p-8 pt-6 space-y-8">
                    {children}
                </div>
            </div>
        </div>
    );
};
