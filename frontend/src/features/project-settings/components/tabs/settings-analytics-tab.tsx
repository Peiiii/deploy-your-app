import React from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, Clock, Eye, Heart, Star } from 'lucide-react';
import { useAnalyticsStore } from '@/stores/analytics.store';
import { useReactionStore } from '@/stores/reaction.store';
import type { Project } from '@/types';

interface SettingsAnalyticsTabProps {
    project: Project;
}

export const SettingsAnalyticsTab: React.FC<SettingsAnalyticsTabProps> = ({
    project,
}) => {
    const { t } = useTranslation();

    // Subscribe to analytics from store
    const analyticsEntry = useAnalyticsStore((s) => s.byProjectId[project.id]);
    const reactionEntry = useReactionStore((s) => s.byProjectId[project.id]);
    const views7d = analyticsEntry?.stats?.views7d ?? 0;
    const totalViews = analyticsEntry?.stats?.totalViews ?? 0;
    const lastViewAt = analyticsEntry?.stats?.lastViewAt;
    const isLoading = analyticsEntry?.isLoading ?? false;
    const error = analyticsEntry?.error;

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="glass-card rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-lg bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400">
                        <BarChart3 className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                            {t('project.analytics', 'Project Analytics')}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {t('project.analyticsDescription', 'Track views and engagement statistics.')}
                        </p>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-950/20 p-4 text-sm text-red-600 dark:text-red-400">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Card 1: 7-Day Views */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-5">
                        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-2">
                            <Eye className="w-4 h-4" />
                            <span>{t('project.viewsLast7Days')}</span>
                        </div>
                        <div className="text-3xl font-bold text-slate-900 dark:text-white">
                            {isLoading ? (
                                <div className="h-9 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                            ) : (
                                views7d.toLocaleString()
                            )}
                        </div>
                    </div>

                    {/* Card: Total Likes */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-5">
                        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-2">
                            <Heart className="w-4 h-4" />
                            <span>{t('project.totalLikes', 'Total Likes')}</span>
                        </div>
                        <div className="text-3xl font-bold text-slate-900 dark:text-white">
                            {isLoading ? (
                                <div className="h-9 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                            ) : (
                                (reactionEntry?.likesCount ?? 0).toLocaleString()
                            )}
                        </div>
                    </div>

                    {/* Card: Total Favorites */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-5">
                        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-2">
                            <Star className="w-4 h-4" />
                            <span>{t('project.totalFavorites', 'Total Favorites')}</span>
                        </div>
                        <div className="text-3xl font-bold text-slate-900 dark:text-white">
                            {isLoading ? (
                                <div className="h-9 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                            ) : (
                                (reactionEntry?.favoritesCount ?? 0).toLocaleString()
                            )}
                        </div>
                    </div>

                    {/* Card 2: Total Views */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-5">
                        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-2">
                            <Eye className="w-4 h-4" />
                            <span>{t('project.totalViews')}</span>
                        </div>
                        <div className="text-3xl font-bold text-slate-900 dark:text-white">
                            {isLoading ? (
                                <div className="h-9 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                            ) : (
                                totalViews.toLocaleString()
                            )}
                        </div>
                    </div>

                    {/* Card 3: Last View */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-5">
                        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-2">
                            <Clock className="w-4 h-4" />
                            <span>{t('project.lastView')}</span>
                        </div>
                        <div className="text-lg font-semibold text-slate-900 dark:text-white mt-1">
                            {isLoading ? (
                                <div className="h-7 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                            ) : lastViewAt ? (
                                new Date(lastViewAt).toLocaleString(undefined, {
                                    dateStyle: 'medium',
                                    timeStyle: 'short'
                                })
                            ) : (
                                <span className="text-slate-400 italic">--</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
