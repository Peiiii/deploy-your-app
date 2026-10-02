import React, { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';

interface WizardLayoutProps {
    children: ReactNode;
    steps: { label: string; active?: boolean; completed?: boolean }[];
}

export const WizardLayout: React.FC<WizardLayoutProps> = ({
    children,
    steps,
}) => {
    const { t } = useTranslation();

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-black/20 flex flex-col">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20">
                <div className="max-w-3xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
                    <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                        {t('common.newProject')}
                    </h1>

                    {/* Steps Indicator */}
                    <div className="hidden md:flex items-center gap-2 text-sm">
                        {steps.map((step, index) => (
                            <React.Fragment key={step.label}>
                                {index > 0 && (
                                    <ChevronRight className="w-4 h-4 text-slate-400" />
                                )}
                                <span
                                    className={`${step.active
                                            ? 'text-brand-600 dark:text-brand-400 font-semibold'
                                            : step.completed
                                                ? 'text-slate-900 dark:text-white'
                                                : 'text-slate-500 dark:text-slate-500'
                                        }`}
                                >
                                    {step.label}
                                </span>
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 py-12 px-4">
                <div className="max-w-3xl mx-auto">
                    {children}
                </div>
            </div>
        </div>
    );
};
