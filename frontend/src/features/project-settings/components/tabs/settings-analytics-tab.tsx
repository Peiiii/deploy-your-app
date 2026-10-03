import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, Eye, Users, ThumbsUp, Star } from 'lucide-react';
import { usePresenter } from '@/contexts/presenter-context';
import { useAnalyticsStore } from '@/stores/analytics.store';
import { useReactionStore } from '@/stores/reaction.store';
import type { Project } from '@/types';

export const SettingsAnalyticsTab: React.FC<{ project: Project }> = ({ project }) => {
    const { t } = useTranslation();
    const presenter = usePresenter();
    const entry = useAnalyticsStore(s => s.byProjectId[project.id]);
    const reactions = useReactionStore(s => s.byProjectId[project.id]);
    const range = entry?.range ?? '7d';
    const stats = entry?.stats?.range === range ? entry.stats : null;
    const loading = !entry || entry.isLoading;
    const load = (next = range) => presenter.projectSettings.loadAnalytics(project.id, next);
    useEffect(() => {
        const selectedRange = useAnalyticsStore.getState().byProjectId[project.id]?.range ?? '7d';
        presenter.projectSettings.loadAnalytics(project.id, selectedRange);
    }, [project.id, presenter.projectSettings]);
    const value = (count: number | null | undefined) => loading ? '…' : entry?.error || count == null ? '—' : count.toLocaleString();
    const max = Math.max(1, ...stats?.points.map(point => point.views ?? 0) ?? []);
    const metrics = [
        { icon: Eye, label: t('appAnalytics.pv'), count: stats?.pageViews },
        { icon: Users, label: t('appAnalytics.uv'), count: stats?.uniqueVisitors },
        { icon: ThumbsUp, label: t('project.totalLikes', 'Total Likes'), count: reactions?.likesCount },
        { icon: Star, label: t('project.totalFavorites', 'Total Favorites'), count: reactions?.favoritesCount },
    ];
    return (
        <div className="space-y-6 animate-fade-in" aria-busy={loading}>
            <div className="glass-card rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <BarChart3 className="w-5 h-5 text-brand-600" />
                        <div><h3 className="font-semibold">{t('project.analytics')}</h3><p className="text-sm text-slate-500">{t('appAnalytics.description')}</p></div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <label className="sr-only" htmlFor="analytics-range">{t('appAnalytics.range')}</label>
                        <select id="analytics-range" className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm" value={range} onChange={event => load(event.target.value as '7d' | '30d')}>
                            <option value="7d">{t('appAnalytics.days7')}</option><option value="30d">{t('appAnalytics.days30')}</option>
                        </select>
                        <button type="button" disabled={loading} onClick={() => load()} className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm disabled:opacity-50">{t('appAnalytics.refresh')}</button>
                    </div>
                </div>
                {entry?.error && <div role="alert" className="rounded-lg bg-red-50 dark:bg-red-950/20 p-4 text-sm text-red-600 dark:text-red-400 flex flex-wrap items-center gap-3"><span>{t('appAnalytics.error')}</span><button type="button" onClick={() => load()} className="underline">{t('common.retry')}</button></div>}
                {stats && !entry?.error && <div className="rounded-lg bg-slate-100 dark:bg-slate-900 p-4 text-sm space-y-1" role="status">
                    <p>{stats.coverage.status === 'unavailable' ? t('appAnalytics.unavailable') : stats.coverage.status === 'partial' ? t('appAnalytics.partial') : t('appAnalytics.complete')}</p>
                    {stats.coverage.startedAt && <p>{t('appAnalytics.started', { at: stats.coverage.startedAt.replace('T', ' ').replace('.000Z', ' UTC') })}</p>}
                    <p className="text-slate-500">{stats.from} – {stats.to} · {t('appAnalytics.utc')}</p>
                </div>}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {metrics.map(metric => <div key={metric.label} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-4">
                        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2"><metric.icon className="w-4 h-4 shrink-0" /><span>{metric.label}</span></div>
                        <div className="text-3xl font-bold" data-metric={metric.label}>{value(metric.count)}</div>
                    </div>)}
                </div>
                {stats && !entry?.error && !loading && <>
                    <div>
                        <h4 className="font-medium mb-3">{t('appAnalytics.trend')}</h4>
                        <div className="max-h-96 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800">
                            <table className="w-full text-sm"><thead className="sticky top-0 bg-slate-100 dark:bg-slate-900"><tr><th scope="col" className="text-left p-3">{t('appAnalytics.date')}</th><th scope="col" className="text-right p-3">PV</th><th scope="col" className="text-right p-3">{t('appAnalytics.dailyUv')}</th></tr></thead>
                                <tbody>{[...stats.points].reverse().map(point => <tr key={point.date} className="border-t border-slate-100 dark:border-slate-800">
                                    <th scope="row" className="text-left font-normal p-3 whitespace-nowrap">{point.date.slice(5)}{point.coverage === 'partial' && <span className="block text-xs text-slate-500">{t('appAnalytics.partialDay')}</span>}</th>
                                    <td className="p-3"><div className="flex items-center justify-end gap-3"><span aria-hidden="true" className="hidden sm:block h-2 rounded bg-brand-500" style={{ width: `${(point.views ?? 0) / max * 100}%`, maxWidth: '120px' }} /><span className="shrink-0">{point.views == null ? t('appAnalytics.missing') : point.views.toLocaleString()}</span></div></td>
                                    <td className="text-right p-3">{point.uniqueVisitors == null ? '—' : point.uniqueVisitors.toLocaleString()}</td>
                                </tr>)}</tbody>
                            </table>
                        </div>
                    </div>
                    <p className="text-sm text-slate-500">{t('appAnalytics.lastVisit')}: {stats.lastViewAt ? new Date(stats.lastViewAt).toLocaleString() : '—'}</p>
                    {stats.unidentifiedViews > 0 && <p className="text-sm text-amber-700 dark:text-amber-400">{t('appAnalytics.unidentified', { count: stats.unidentifiedViews })}</p>}
                </>}
                <div className="text-xs text-slate-500 space-y-2"><p>{t('appAnalytics.pvDefinition')}</p><p>{t('appAnalytics.uvDefinition')}</p><p>{t('appAnalytics.limitations')}</p></div>
            </div>
        </div>
    );
};
