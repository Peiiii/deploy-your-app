import { useCallback, useEffect, useRef, useState } from 'react';
import type { ExploreAppCard } from '../../components/ExploreAppCard';
import { mapProjectsToApps } from '../../components/ExploreAppCard';
import { usePresenter } from '../../contexts/PresenterContext';
import { useAuthStore } from '../../stores/authStore';
import { fetchExploreProjects } from '../../services/http/exploreApi';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { APP_META, type CategoryFilter, type SortOption } from './homeExplore';

export const useHomeExploreFeed = () => {
  const presenter = usePresenter();
  const [apps, setApps] = useState<ExploreAppCard[]>([]);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('All Apps');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('popularity');
  const [isLoadingExplore, setIsLoadingExplore] = useState(false);
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
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoadingExplore(true);
        setIsLoadingMore(false);
      }

      try {
        const result = await fetchExploreProjects({
          search: searchQuery.trim() || undefined,
          category: activeCategory !== 'All Apps' ? activeCategory : undefined,
          tag: activeTag,
          sort: sortBy,
          page: pageToLoad,
          pageSize: PAGE_SIZE,
        });

        if (requestId !== exploreRequestIdRef.current) return;

        const projects = result.items;
        const pageApps = mapProjectsToApps(projects, APP_META);
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
        console.error('Failed to load explore apps for Home', error);
      } finally {
        if (requestId !== exploreRequestIdRef.current) return;
        setIsLoadingExplore(false);
        setIsLoadingMore(false);
      }
    },
    [
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
    rootMargin: '400px',
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
    isLoadingMore,
    hasMore,
    loadMoreRef,
    handleLoadMoreExplore,
  };
};

