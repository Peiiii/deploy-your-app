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
  findProjectByRepoUrl(repoUrl: string): Promise<Project | null>;
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
  deleteProject(id: string): Promise<void>;
}

export interface IDeploymentProvider {
  startDeployment(
    project: Project,
    onLog: (log: BuildLog) => void,
    onStatusChange: (status: DeploymentStatus) => void,
  ): Promise<DeploymentResult | undefined>;

  /**
   * Optional pre-deployment analysis step. For GitHub-based projects this
   * allows the backend to inspect the source code and propose richer
   * metadata (name, slug, tags). The returned analysisId can be passed
   * back to the deployment job so that the Node builder can reuse the
   * prepared work directory.
   */
  analyzeSource(
    project: Project,
  ): Promise<{ metadata?: DeploymentMetadata; analysisId?: string }>;
}

export interface IAnalyticsProvider {
  getProjectStats(
    projectId: string,
    range: '7d' | '30d',
  ): Promise<ProjectStats>;
}

export interface IReactionProvider {
  getReactionsForProject(projectId: string): Promise<ProjectReactions>;
  getReactionsForProjectsBulk(
    projectIds: string[],
  ): Promise<Record<string, ProjectReactions>>;
  setLike(projectId: string, liked: boolean): Promise<ProjectReactions>;
  setFavorite(
    projectId: string,
    favorited: boolean,
  ): Promise<ProjectReactions>;
  getFavoriteProjectIdsForCurrentUser(): Promise<string[]>;
}
