import type {
  Project,
  BuildLog,
  DeploymentMetadata,
  ProjectStats,
  ProjectReactions,
} from '../types';
import { DeploymentStatus, SourceType } from '../types';

export interface DeploymentResult {
  metadata?: DeploymentMetadata;
}

export interface IProjectProvider {
  getProjects(): Promise<Project[]>;
  createProject(
    name: string,
    sourceType: SourceType,
    identifier: string,
    options?: { htmlContent?: string; metadata?: DeploymentMetadata },
  ): Promise<Project>;
  updateProject(
    id: string,
    patch: {
      name?: string;
      repoUrl?: string;
      description?: string;
      category?: string;
      tags?: string[];
      isPublic?: boolean;
    },
  ): Promise<Project>;
}

export interface IDeploymentProvider {
  startDeployment(
    project: Project,
    onLog: (log: BuildLog) => void,
    onStatusChange: (status: DeploymentStatus) => void,
  ): Promise<DeploymentResult | undefined>;
}

export interface IAnalyticsProvider {
  getProjectStats(
    projectId: string,
    range: '7d' | '30d',
  ): Promise<ProjectStats>;
}

export interface IReactionProvider {
  getReactionsForProject(projectId: string): Promise<ProjectReactions>;
  setLike(projectId: string, liked: boolean): Promise<ProjectReactions>;
  setFavorite(
    projectId: string,
    favorited: boolean,
  ): Promise<ProjectReactions>;
  getFavoriteProjectIdsForCurrentUser(): Promise<string[]>;
}
