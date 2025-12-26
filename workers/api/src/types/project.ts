export enum SourceType {
  GitHub = 'github',
  Zip = 'zip',
  Html = 'html',
}

export type DeploymentStatus = 'Live' | 'Building' | 'Failed' | 'Offline';

export interface Project {
  id: string;
  ownerId?: string;
  ownerHandle?: string | null;
  ownerDisplayName?: string | null;
  // Whether this project should appear in public feeds (Explore, recommendations).
  // For legacy rows without this field, the system treats them as public.
  isPublic?: boolean;
  // Soft delete flag (admin/offline cleanup). Deleted projects should be hidden from public feeds.
  isDeleted?: boolean;
  // Whether this project is allowed to appear in the browser-extension surfaces.
  // Legacy projects without this flag are treated as NOT extension-supported.
  isExtensionSupported?: boolean;
  name: string;
  repoUrl: string;
  sourceType?: SourceType;
  slug?: string;
  analysisId?: string;
  lastDeployed: string;
  status: DeploymentStatus;
  url?: string;
  description?: string;
  framework: 'React' | 'Vue' | 'Next.js' | 'Unknown';
  category?: string;
  tags?: string[];
  deployTarget?: 'local' | 'cloudflare' | 'r2';
  providerUrl?: string;
  cloudflareProjectName?: string;
  htmlContent?: string;
}

export interface ProjectMetadataOverrides {
  name?: string;
  slug?: string;
  description?: string;
  category?: string;
  tags?: string[];
}

export interface ResolvedProjectMetadata {
  name: string;
  slug: string;
  description?: string;
  category: string;
  tags: string[];
}

export interface CreateProjectRecordInput {
  id: string;
  ownerId?: string;
  isPublic?: boolean;
  isExtensionSupported?: boolean;
  name: string;
  repoUrl: string;
  sourceType?: SourceType;
  slug?: string;
  analysisId?: string;
  lastDeployed: string;
  status: DeploymentStatus;
  url?: string;
  description?: string;
  framework: 'React' | 'Vue' | 'Next.js' | 'Unknown';
  category?: string;
  tags?: string[];
  deployTarget?: 'local' | 'cloudflare' | 'r2';
  providerUrl?: string;
  cloudflareProjectName?: string;
  htmlContent?: string;
}

/** SSE payload received from deploy service status updates */
export interface DeploymentStatusPayload {
  type?: string;
  status?: 'SUCCESS' | 'FAILED' | string;
  projectMetadata?: ProjectMetadataOverrides & { url?: string };
}
