import type { Project } from '@/types';
import { getProjectDescription } from '@/utils/project';
import type { SortDirection, SortOption } from '@/features/dashboard/stores/dashboard.store';

export interface ManagementQuery {
  searchQuery: string;
  showFavoritesOnly: boolean;
  statusFilter: Project['status'] | null;
  sortBy: SortOption;
  sortDirection: SortDirection;
}

export function selectManagementProjects(
  projects: Project[],
  query: ManagementQuery,
  favorites: ReadonlySet<string>,
  language: string
): Project[] {
  const search = query.searchQuery.trim().toLocaleLowerCase();
  const rank: Record<Project['status'], number> = { Live: 0, Building: 1, Failed: 2, Offline: 3 };
  const timestamp = (value: string) => {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  return projects
    .filter((project) => {
      if (query.statusFilter && project.status !== query.statusFilter) return false;
      if (query.showFavoritesOnly && !favorites.has(project.id)) return false;
      return (
        !search ||
        [
          project.name,
          getProjectDescription(project, language),
          project.repoUrl,
          project.url,
          project.framework,
        ].some((value) => value?.toLocaleLowerCase().includes(search))
      );
    })
    .sort((a, b) => {
      const comparison =
        query.sortBy === 'name'
          ? a.name.localeCompare(b.name, language)
          : query.sortBy === 'status'
            ? rank[a.status] - rank[b.status]
            : timestamp(a.lastDeployed) - timestamp(b.lastDeployed);
      return (query.sortDirection === 'asc' ? comparison : -comparison) || a.id.localeCompare(b.id);
    });
}
