export enum SourceType {
  GitHub = 'github',
  Zip = 'zip',
  Html = 'html',
}

export type DeploymentStatus = 'Live' | 'Building' | 'Failed' | 'Offline';

export interface Project {
  id: string;
  ownerId?: string;
  // Whether this project should appear in public feeds (Explore, recommendations).
  // For legacy rows without this field, the system treats them as public.
  isPublic?: boolean;
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
