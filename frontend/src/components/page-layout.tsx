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
        <div className="flex flex-col h-full bg-[#f8fafc] dark:bg-slate-900">
            {/* Header */}
            <header className={`${isCompact ? 'h-16' : 'h-20'} px-4 md:px-8 flex items-center justify-between sticky top-0 bg-[#f8fafc]/80 dark:bg-slate-900/80 backdrop-blur z-20 border-b border-slate-100 dark:border-slate-800/50 transition-all duration-300`}>
                <div className="flex items-center gap-4 min-w-0">
                    <h1 className={`${isCompact ? 'text-xl md:text-2xl' : 'text-2xl md:text-3xl'} font-bold text-slate-900 dark:text-white tracking-tight truncate transition-all duration-300`}>
                        {title}
                    </h1>
                </div>
                {actions && <div className="flex items-center gap-3">{actions}</div>}
            </header>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto">
                <div className={`max-w-7xl mx-auto ${isCompact ? 'p-3' : 'p-4 md:p-8'} pt-6 space-y-8 transition-all duration-300`}>
                    {children}
                </div>
            </div>
        </div>
    );
};
