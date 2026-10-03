import React from 'react';
import { useTranslation } from 'react-i18next';
import { usePresenter } from '@/contexts/presenter-context';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { useAppLanguageStore } from '../stores/app-language.store';
import { useExploreStore } from '../stores/explore.store';
import { ExploreFeed } from '../components/explore-feed';
import { recommendationFeedManager as manager, useRecommendationFeedStore } from './feed.manager';

export function RecommendationFeed({ onToggleView }: { onToggleView: () => void }) {
  const { t } = useTranslation();
  const presenter = usePresenter();
  const languages = useAppLanguageStore((s) => s.languages);
  const category = useExploreStore((s) => s.activeCategory);
  const search = useExploreStore((s) => s.searchQuery);
  const tag = useExploreStore((s) => s.activeTag);
  const account = useAuthStore((s) => s.user?.id);
  const authLoading = useAuthStore((s) => s.isLoading);
  const state = useRecommendationFeedStore();
  const [notice, setNotice] = React.useState('');
  React.useEffect(() => {
    if (authLoading) return;
    manager.start(
      {
        languages: languages || undefined,
        category: category === 'All Apps' ? undefined : category,
        search: search || undefined,
        tag: tag || undefined,
      },
      presenter.reaction
    );
    return manager.stop;
  }, [languages, category, search, tag, account, authLoading, presenter.reaction]);
  const run = async (action: () => Promise<void>) => {
    try {
      await action();
      setNotice(t('explore.recommendation.cleared'));
    } catch {
      setNotice(t('languages.loadFailed'));
    }
  };
  const controls = state.enabled ? (
    <div className="max-w-[65vw] text-white text-center">
      <select
        aria-label={t('explore.recommendation.order')}
        value={state.mode}
        onChange={(e) => manager.setMode(e.target.value as 'experiment' | 'recent' | 'recommended')}
        className="rounded-full bg-black/60 px-3 py-1.5 text-sm border border-white/30"
      >
        <option value="experiment">{t('explore.recommendation.discover')}</option>
        <option value="recommended">{t('explore.recommendation.try')}</option>
        <option value="recent">{t('explore.recommendation.recent')}</option>
      </select>
      <details className="relative text-xs mt-1">
        <summary className="cursor-pointer inline-block rounded-full bg-black/60 px-2 py-1 text-white">
          {t('explore.recommendation.preferences')}
        </summary>
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-64 max-w-[75vw] bg-slate-900 border border-white/20 rounded-xl p-3 shadow-lg text-left">
          <p className="mb-3">{t('explore.recommendation.explanation')}</p>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={state.persistent}
              disabled={navigator.doNotTrack === '1'}
              onChange={(e) => void run(() => manager.setPersistent(e.target.checked))}
            />
            {t('explore.recommendation.remember')}
          </label>
          <button type="button" onClick={() => void run(manager.clear)} className="mt-3 underline">
            {t('explore.recommendation.clear')}
          </button>
          {notice && (
            <p role="status" className="mt-2">
              {notice}
            </p>
          )}
        </div>
      </details>
    </div>
  ) : undefined;
  return (
    <ExploreFeed
      key={JSON.stringify([
        account,
        languages,
        category,
        search,
        tag,
        state.mode,
        state.persistent,
      ])}
      apps={state.apps}
      hasMore={state.hasMore}
      isLoading={state.isLoading}
      error={state.error}
      onRetry={manager.retry}
      onLoadMore={manager.loadMore}
      onToggleView={onToggleView}
      controls={controls}
      onActive={manager.activate}
      onFeedback={state.enabled ? manager.feedback : undefined}
    />
  );
}
