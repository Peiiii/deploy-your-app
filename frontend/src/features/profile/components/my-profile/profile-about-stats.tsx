import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X, ArrowUp, ArrowDown } from 'lucide-react';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { useMyProfileStore } from '@/features/profile/stores/my-profile.store';
import { usePresenter } from '@/contexts/presenter-context';

export const ProfileAboutStats: React.FC = () => {
    const { t } = useTranslation();
    const presenter = usePresenter();
    const user = useAuthStore((s) => s.user);

    const profileData = useMyProfileStore((s) => s.profileData);
    const bio = useMyProfileStore((s) => s.bio);
    const links = useMyProfileStore((s) => s.links);
    const handleInput = useMyProfileStore((s) => s.handleInput);
    const handleError = useMyProfileStore((s) => s.handleError);
    const isLoading = useMyProfileStore((s) => s.isLoading);
    const actions = useMyProfileStore((s) => s.actions);

    if (!user) return null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* About Section */}
            <div className="md:col-span-2 glass-card rounded-xl p-5 border border-slate-200 dark:border-slate-800">
                <div className="mb-4">
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                        {t('profile.handleLabel', 'Profile handle')}
                    </label>
                    <input
                        type="text"
                        value={handleInput}
                        onChange={(e) => presenter.myProfile.validateHandle(e.target.value)}
                        placeholder={t('profile.handlePlaceholder', 'e.g. peiwang')}
                        className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/60 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        {t('profile.handleHint', 'Your public URL will be')}:{' '}
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                            {window.location.origin}/u/
                            {encodeURIComponent(handleInput.trim() || user.handle || user.id)}
                        </span>
                    </p>
                    {handleError && (
                        <p className="mt-1 text-[11px] text-red-500 dark:text-red-400">{handleError}</p>
                    )}
                </div>

                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">
                    {t('profile.about')}
                </h3>
                <textarea
                    value={bio}
                    onChange={(e) => actions.setBio(e.target.value)}
                    placeholder={t('profile.bioPlaceholder')}
                    rows={4}
                    className="w-full resize-none text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/60 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
                <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                            {t('profile.links')}
                        </label>
                        <button
                            type="button"
                            onClick={actions.addLink}
                            className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            {t('profile.addLink')}
                        </button>
                    </div>
                    {links.length === 0 ? (
                        <div className="text-xs text-slate-500 dark:text-slate-400 py-2">
                            {t('profile.linksEmptyHint')}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {links.map((link, index) => (
                                <div key={index} className="flex gap-2">
                                    <input
                                        type="text"
                                        value={link.url}
                                        onChange={(e) => actions.updateLink(index, 'url', e.target.value)}
                                        placeholder={t('profile.linkUrlPlaceholder')}
                                        className="flex-1 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/60 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => actions.removeLink(index)}
                                        className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                                        title={t('profile.removeLink')}
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                    <div className="flex flex-col gap-1">
                                        <button
                                            type="button"
                                            onClick={() => actions.moveLink(index, 'up')}
                                            className="inline-flex items-center justify-center w-7 h-4 rounded border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
                                            disabled={index === 0}
                                            title={t('profile.moveLinkUp', 'Move up')}
                                        >
                                            <ArrowUp className="w-3 h-3" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => actions.moveLink(index, 'down')}
                                            className="inline-flex items-center justify-center w-7 h-4 rounded border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
                                            disabled={index === links.length - 1}
                                            title={t('profile.moveLinkDown', 'Move down')}
                                        >
                                            <ArrowDown className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Stats Section */}
            <div className="glass-card rounded-xl p-5 border border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">
                    {t('profile.communityStats')}
                </h3>
                {isLoading || !profileData ? (
                    <div className="space-y-3">
                        <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                        <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                        <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                    </div>
                ) : (
                    <div className="space-y-3 text-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-slate-500 dark:text-slate-400">
                                {t('profile.publicApps')}
                            </span>
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {profileData.stats.publicProjectsCount}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-slate-500 dark:text-slate-400">
                                {t('profile.totalLikes')}
                            </span>
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {profileData.stats.totalLikes}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-slate-500 dark:text-slate-400">
                                {t('profile.totalFavorites')}
                            </span>
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {profileData.stats.totalFavorites}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
