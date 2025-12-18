import { APP_CONFIG, API_ROUTES } from '@/constants';
import type { PaginatedResponse, Project } from '@/types';

const API_BASE = APP_CONFIG.API_BASE_URL.replace(/\/+$/, '');

export async function fetchAdminProjects(params: {
  search?: string;
  page?: number;
  pageSize?: number;
  includeDeleted?: boolean;
}): Promise<PaginatedResponse<Project>> {
  const url = new URL(`${API_BASE}${API_ROUTES.ADMIN_PROJECTS}`, window.location.origin);
  if (params.search) url.searchParams.set('search', params.search);
  if (params.page) url.searchParams.set('page', String(params.page));
  if (params.pageSize) url.searchParams.set('pageSize', String(params.pageSize));
  if (params.includeDeleted === false) url.searchParams.set('includeDeleted', 'false');

  const res = await fetch(url.toString(), {
    method: 'GET',
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error('Failed to load admin projects');
  }

  return (await res.json()) as PaginatedResponse<Project>;
}

export async function adminDeleteProject(id: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}${API_ROUTES.ADMIN_PROJECTS}/${encodeURIComponent(id)}`,
    { method: 'DELETE', credentials: 'include' },
  );
  if (!res.ok) {
    throw new Error('Failed to delete project');
  }
}

export async function adminRestoreProject(id: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}${API_ROUTES.ADMIN_PROJECTS}/${encodeURIComponent(id)}/restore`,
    { method: 'POST', credentials: 'include' },
  );
  if (!res.ok) {
    throw new Error('Failed to restore project');
  }
}
