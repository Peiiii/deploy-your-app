import { useAppLanguageStore } from '@/features/explore/stores/app-language.store';
import { track } from '@/analytics/collector';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ExploreAppCard } from '@/components/explore-app-card';
import { mapProjectsToApps } from '@/components/explore-app-card';
import { usePresenter } from '@/contexts/presenter-context';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { fetchExploreProjects } from '@/services/http/explore-api';
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll';
import { rankHomeRecommendations, type CategoryFilter, type SortOption } from '@/features/home/components/home-explore';
import { PERFORMANCE_CONFIG } from '@/constants';

export const useHomeExploreFeed = () => {
  const presenter = usePresenter();
  const languages = useAppLanguageStore(s => s.languages);
  const [apps, setApps] = useState<ExploreAppCard[]>([]);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('All Apps');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recommended');
  const [isLoadingExplore, setIsLoadingExplore] = useState(true);
  const [exploreError, setExploreError] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const exploreRequestIdRef = useRef(0);
  const PAGE_SIZE = 12;

  const mergeUniqueApps = useCallback((prev: ExploreAppCard[], next: ExploreAppCard[]) => {
    if (prev.length === 0) return next;
    const existingIds = new Set(prev.map((app) => app.id));
    const merged = [...prev];
    next.forEach((app) => {
      if (!existingIds.has(app.id)) {
        existingIds.add(app.id);
        merged.push(app);
      }
    });
    return merged;
  }, []);

  const loadExplorePage = useCallback(
    async (pageToLoad: number, append: boolean) => {
      const requestId = ++exploreRequestIdRef.current;
      setExploreError(false);
      if (append) {
        setIsLoadingMore(true);
      } else {
        console.log('[useHomeExploreFeed] loading explore page', {
          pageToLoad,
          append,
        });
        setIsLoadingExplore(true);
        setIsLoadingMore(false);
      }

      try {
      if (pageToLoad === 1 && searchQuery.trim()) track('search_submit');
        const result = await fetchExploreProjects({
          languages,
          search: searchQuery.trim() || undefined,
          category: activeCategory !== 'All Apps' ? activeCategory : undefined,
          tag: activeTag,
          sort: sortBy === 'recommended' ? 'popularity' : sortBy,
          page: pageToLoad,
          pageSize: sortBy === 'recommended' ? 36 : PAGE_SIZE,
        });

        if (requestId !== exploreRequestIdRef.current || JSON.stringify(languages) !== JSON.stringify(useAppLanguageStore.getState().languages)) return;
        useAppLanguageStore.getState().actions.setAvailable(result.availableLanguages || []);

        const projects = result.items;
        const mapped = mapProjectsToApps(projects);
        const pageApps = sortBy === 'recommended' && activeCategory === 'All Apps' && !activeTag && !searchQuery.trim()
          ? rankHomeRecommendations(mapped) : mapped;
        setApps((prev) => (append ? mergeUniqueApps(prev, pageApps) : pageApps));

        setPage(result.page);
        setHasMore(result.page * result.pageSize < result.total);

        if (result.engagement) {
          const projectsWithCounts = projects.map((p) => {
            const counts = result.engagement?.[p.id];
            return {
              ...p,
              likesCount: counts?.likesCount ?? 0,
              favoritesCount: counts?.favoritesCount ?? 0,
            };
          });
          presenter.reaction.seedCountsFromProjects(projectsWithCounts);
        }

        const currentUser = useAuthStore.getState().user;
        if (currentUser) {
          const ids = projects.map((p) => p.id);
          presenter.reaction.loadReactionsForProjectsBulk(ids);
        }
      } catch (error) {
        if (requestId === exploreRequestIdRef.current) setExploreError(true);
        console.error('Failed to load explore apps for Home', error);
      } finally {
        console.log('[useHomeExploreFeed] finally', {
          requestId,
          exploreRequestIdRefCurrent: exploreRequestIdRef.current,
        });
        if (requestId === exploreRequestIdRef.current) {
          setIsLoadingExplore(false);
          setIsLoadingMore(false);
        }
      }
    },
    [
      languages,
      activeCategory,
      activeTag,
      mergeUniqueApps,
      presenter.reaction,
      searchQuery,
      sortBy,
    ],
  );

  useEffect(() => {
    setApps([]);
    setPage(1);
    setHasMore(false);
    void loadExplorePage(1, false);
  }, [activeCategory, activeTag, loadExplorePage, searchQuery, sortBy]);

  const handleLoadMoreExplore = useCallback(() => {
    if (!hasMore || isLoadingExplore || isLoadingMore) return;
    void loadExplorePage(page + 1, true);
  }, [hasMore, isLoadingExplore, isLoadingMore, loadExplorePage, page]);

  useInfiniteScroll({
    targetRef: loadMoreRef,
    onLoadMore: handleLoadMoreExplore,
    enabled: hasMore && !isLoadingExplore && !isLoadingMore,
    rootMargin: PERFORMANCE_CONFIG.EXPLORE_PRELOAD_ROOT_MARGIN,
  });

  return {
    apps,
    activeCategory,
    setActiveCategory,
    activeTag,
    setActiveTag,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    isLoadingExplore,
    exploreError,
    retryExplore: () => void loadExplorePage(1, false),
    isLoadingMore,
    hasMore,
    loadMoreRef,
    handleLoadMoreExplore,
  };
};
