export enum DeploymentStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  BUILDING = 'BUILDING',
  DEPLOYING = 'DEPLOYING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED'
}

export enum SourceType {
  GITHUB = 'github',
  ZIP = 'zip',
  HTML = 'html',
}

export interface Project {
  id: string;
  name: string;
  repoUrl: string; // Used as source identifier (URL for git, filename for zip)
  sourceType?: SourceType;
  slug?: string;
  // Optional base64-encoded ZIP content for one-off deployments when sourceType === 'zip'.
  // This is only used for the deployment job and is not persisted in the project list.
  zipData?: string;
  lastDeployed: string;
  status: 'Live' | 'Building' | 'Failed' | 'Offline';
  url?: string;
  // Short marketing-style summary used by Explore Apps and dashboards.
  description?: string;
  framework: 'React' | 'Vue' | 'Next.js' | 'Unknown';
  // High-level category used by Explore Apps (e.g. "Development", "Image Gen").
  category?: string;
  // Optional tags for finer-grained filtering/search (e.g. ["chatbot", "landing-page"]).
  tags?: string[];
  // Where this project is deployed (mirrors backend Project.deployTarget).
  deployTarget?: 'local' | 'cloudflare' | 'r2';
  // Optional provider-level URL (e.g. Cloudflare Pages / R2 prefix).
  providerUrl?: string;
  // Cloudflare Pages project name when using the Cloudflare provider.
  cloudflareProjectName?: string;
  // Inline HTML payload used when sourceType === SourceType.HTML.
  htmlContent?: string;
}

export interface BuildLog {
  timestamp: string;
  message: string;
  type: 'info' | 'error' | 'success' | 'warning';
}

export interface DeploymentMetadata {
  name: string;
  slug: string;
  description?: string;
  category: string;
  tags: string[];
  url?: string;
}
