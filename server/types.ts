export type DeploymentStatus =
  | 'IDLE'
  | 'ANALYZING'
  | 'BUILDING'
  | 'DEPLOYING'
  | 'SUCCESS'
  | 'FAILED';

export type LogLevel = 'info' | 'error' | 'success' | 'warning';

export interface BuildLog {
  timestamp: string;
  message: string;
  level: LogLevel;
}

export interface Project {
  id: string;
  name: string;
  repoUrl: string;
  sourceType?: 'github' | 'zip';
  analysisId?: string;
  lastDeployed: string;
  status: 'Live' | 'Building' | 'Failed' | 'Offline';
  url?: string;
   // Short marketing-style summary shown on the Explore page.
   description?: string;
  framework: 'React' | 'Vue' | 'Next.js' | 'Unknown';
  // High-level category used by the Explore Apps marketplace view.
  category?: string;
  // Optional tags for finer-grained filtering/search (e.g. ["chatbot", "landing-page"]).
  tags?: string[];
  // Where this project is deployed.
  deployTarget?: 'local' | 'cloudflare' | 'r2';
  // Provider-level URL (e.g. https://<project>.pages.dev) – mainly for debugging.
  providerUrl?: string;
  // Cloudflare Pages project name when using the Cloudflare provider.
  cloudflareProjectName?: string;
}

export interface DeploymentRecord {
  status: DeploymentStatus;
  logs: BuildLog[];
  project: Project;
  workDir: string | null;
  // Optional base64-encoded ZIP archive used when sourceType === 'zip'
  // and the client uploads a ZIP file instead of providing a remote URL.
  zipData?: string;
}

export interface AnalysisSession {
  workDir: string;
  repoUrl: string;
  filePath: string;
}
