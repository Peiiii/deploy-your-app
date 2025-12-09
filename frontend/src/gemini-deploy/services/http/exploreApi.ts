import { APP_CONFIG, API_ROUTES } from '../../constants';
import type { ExploreProjectsResponse } from '../../types';

export type ExploreSort = 'recent' | 'popularity';

export interface ExploreQueryParams {
  search?: string;
  category?: string;
  tag?: string | null;
  sort?: ExploreSort;
  page?: number;
  pageSize?: number;
}

export async function fetchExploreProjects(
  params: ExploreQueryParams,
): Promise<ExploreProjectsResponse> {
  const query = new URLSearchParams();

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

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to load explore projects');
  }

  return response.json();
}

