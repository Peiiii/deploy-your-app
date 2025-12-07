export enum SourceType {
  GitHub = 'github',
  Zip = 'zip',
  Html = 'html',
}

export type DeploymentStatus = 'Live' | 'Building' | 'Failed' | 'Offline';

export interface Project {
  id: string;
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
