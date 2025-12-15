import React, { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export interface DashboardLayoutProps {
    children: ReactNode;
    actions?: ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
    children,
    actions,
}) => {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-black/20">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20">
                <div className="max-w-6xl mx-auto px-4 md:px-8">
                    <div className="h-16 flex items-center justify-between">
                        {/* Title Section */}
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col">
                                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                                    {t('ui.dashboard')}
                                </h1>
                            </div>
                        </div>

                        {/* Actions */}
                        {actions && <div className="flex items-center gap-3">{actions}</div>}
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 bg-slate-50 dark:bg-black/20 overflow-y-auto">
                <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
                    {children}
                </div>
            </div>
        </div>
    );
};
