import type { ProjectAddressAvailability, ProjectAddressSuggestion } from './project-address';
import type {
  Project,
  BuildLog,
  DeploymentMetadata,
  ProjectLocalization,
  ProjectStats,
  ProjectReactions,
  PaginatedResponse,
} from '../types';
import { DeploymentStatus, SourceType } from '../types';

export interface DeploymentResult {
  metadata?: DeploymentMetadata;
}

export interface DeploymentDiagnostic {
  status: 'started' | 'accepted' | 'succeeded' | 'failed' | 'rejected';
  stage?: string;
  buildMode?: 'static' | 'build';
  errorCode?: string;
  errorMessage?: string;
  startedAt: string;
  finishedAt?: string;
}

export interface IProjectProvider {
  getLatestDeployment(id: string): Promise<DeploymentDiagnostic | null>;
  getProjects(page?: number, pageSize?: number): Promise<PaginatedResponse<Project>>;
  findProjectByRepoUrl(repoUrl: string): Promise<Project | null>;
  generateAddressSuggestion(name: string, projectId?: string, signal?: AbortSignal): Promise<ProjectAddressSuggestion>;
  checkAddressAvailability(slug: string, projectId?: string, signal?: AbortSignal): Promise<ProjectAddressAvailability>;
  createDraftProject(
    name?: string,
    slug?: string,
  ): Promise<Project>;
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
      slug?: string;
      repoUrl?: string;
      description?: string;
      category?: string;
      tags?: string[];
      appLanguages?: string[];
      localization?: ProjectLocalization;
      isPublic?: boolean;
      isExtensionSupported?: boolean;
    },
  ): Promise<Project>;
  updateProjectDeployment(
    id: string,
    patch: {
      status?: Project['status'];
      lastDeployed?: string;
      url?: string;
      deployTarget?: Project['deployTarget'];
      providerUrl?: string;
      cloudflareProjectName?: string;
      deploymentFlowId?: string;
    },
  ): Promise<Project>;
  uploadThumbnail(id: string, file: File): Promise<void>;
  deleteProject(id: string): Promise<void>;
}

export interface IDeploymentProvider {
  startDeployment(
    project: Project,
    onLog: (log: BuildLog) => void,
    onStatusChange: (status: DeploymentStatus) => void,
    context: { flowId: string; clientChannel: NonNullable<Project['clientChannel']>; sourceFilename?: string; zipFile?: File },
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
