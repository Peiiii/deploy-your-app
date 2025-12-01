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
  framework: 'React' | 'Vue' | 'Next.js' | 'Unknown';
}

export interface DeploymentRecord {
  status: DeploymentStatus;
  logs: BuildLog[];
  project: Project;
  workDir: string | null;
}

export interface AnalysisSession {
  workDir: string;
  repoUrl: string;
  filePath: string;
}

