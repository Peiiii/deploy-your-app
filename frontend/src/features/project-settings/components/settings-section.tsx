import React, { type ReactNode } from 'react';

interface SettingsSectionProps {
    title: string;
    description?: string;
    children: ReactNode;
    footer?: ReactNode;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
    title,
    description,
    children,
    footer,
}) => {
    return (
        <div className="flex flex-col md:flex-row md:items-start gap-6 py-8 border-b border-slate-200 dark:border-slate-800 last:border-0 animate-fade-in">
            {/* Left Column: Context (Title & Description) - Width 1/3 */}
            <div className="w-full md:w-1/3 flex-shrink-0">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {title}
                </h3>
                {description && (
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                        {description}
                    </p>
                )}
            </div>

            {/* Right Column: Interaction (Input/Toggle) - Width 2/3 */}
            <div className="w-full md:w-2/3 max-w-2xl">
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
                    <div className="p-4 md:p-6 space-y-4">
                        {children}
                    </div>
                    {footer && (
                        <div className="bg-slate-50 dark:bg-slate-800/50 px-4 md:px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
                            {footer}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
