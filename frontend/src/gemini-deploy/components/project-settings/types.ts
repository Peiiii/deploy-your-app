import type { Project } from '../../types';

export interface ProjectSettingsCardAnalyticsProps {
  views7d: number;
  totalViews: number;
  lastViewAt?: string;
  isLoading: boolean;
  error?: string;
}

export interface ProjectSettingsCardReactionsProps {
  likesCount: number;
  favoritesCount: number;
  likedByCurrentUser: boolean;
  favoritedByCurrentUser: boolean;
}

// Re-export Project here so project-settings subcomponents can import
// everything they need from a single module.
export type ProjectSettingsProject = Project;

