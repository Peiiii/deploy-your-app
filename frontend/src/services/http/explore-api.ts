import { APP_CONFIG, API_ROUTES } from '../../constants';
import type { ExploreProjectsResponse } from '../../types';

export type ExploreSort = 'recent' | 'popularity';

export interface ExploreQueryParams {
  languages?: string[] | null;
  search?: string;
  category?: string;
  tag?: string | null;
  sort?: ExploreSort;
  page?: number;
  pageSize?: number;
}

// Public directory snapshots stay only in this page's memory. Bound freshness
// and capacity, and share pending requests with category intent prefetches.
const CACHE_TTL_MS = 15_000;
const MAX_CACHED_QUERIES = 24;
const queries = new Map<string, {
  promise: Promise<ExploreProjectsResponse>;
  expiresAt: number;
}>();

export function fetchExploreProjects(
  params: ExploreQueryParams,
): Promise<ExploreProjectsResponse> {
  const query = new URLSearchParams();

  if (params.languages) query.set('languages', params.languages.join(','));
  if (params.search && params.search.trim().length > 0) {
    query.set('search', params.search.trim());
  }
  if (params.category && params.category.trim().length > 0) {
    query.set('category', params.category.trim());
  }
  if (params.tag && params.tag.trim().length > 0) {
    query.set('tag', params.tag.trim());
  }
  if (params.sort) {
    query.set('sort', params.sort);
  }
  if (typeof params.page === 'number') {
    query.set('page', String(params.page));
  }
  if (typeof params.pageSize === 'number') {
    query.set('pageSize', String(params.pageSize));
  }

  const qs = query.toString();
  const url = `${APP_CONFIG.API_BASE_URL}${API_ROUTES.EXPLORE_PROJECTS}${
    qs ? `?${qs}` : ''
  }`;

  const cached = queries.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;

  for (const [key, entry] of queries) {
    if (entry.expiresAt <= Date.now()) queries.delete(key);
  }
  const entry = {
    expiresAt: Infinity,
    promise: fetch(url).then(async (response): Promise<ExploreProjectsResponse> => {
      if (!response.ok) throw new Error('Failed to load explore projects');
      const result = await response.json();
      entry.expiresAt = Date.now() + CACHE_TTL_MS;
      return result;
    }).catch((error) => {
      if (queries.get(url) === entry) queries.delete(url);
      throw error;
    }),
  };
  queries.set(url, entry);
  if (queries.size > MAX_CACHED_QUERIES) queries.delete(queries.keys().next().value!);
  return entry.promise;
}
