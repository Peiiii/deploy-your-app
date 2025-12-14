import { useMemoizedFn } from 'ahooks';
import { useEffect } from 'react';
import type { RefObject } from 'react';

export interface UseInfiniteScrollOptions {
  targetRef: RefObject<Element | null>;
  onLoadMore: () => void;
  enabled: boolean;
  root?: Element | null;
  rootMargin?: string;
  threshold?: number;
}

export function useInfiniteScroll({
  targetRef,
  onLoadMore,
  enabled,
  root,
  rootMargin = '200px',
  threshold = 0,
}: UseInfiniteScrollOptions) {
  const memoizedOnLoadMore = useMemoizedFn(onLoadMore);
  useEffect(() => {
    if (!enabled) return;

    const target = targetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first) return;
        if (first.isIntersecting) {
          memoizedOnLoadMore();
        }
      },
      { root: root ?? null, rootMargin, threshold },
    );

    observer.observe(target);
    return () => {
      observer.disconnect();
    };
  }, [enabled, memoizedOnLoadMore, root, rootMargin, targetRef, threshold]);
}
