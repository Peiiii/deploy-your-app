export enum DeploymentStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  BUILDING = 'BUILDING',
  DEPLOYING = 'DEPLOYING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED'
}

export interface Project {
  id: string;
  name: string;
  repoUrl: string; // Used as source identifier (URL for git, filename for zip)
  sourceType?: 'github' | 'zip';
  // Optional analysis session id that links this project to a prepared repo on the backend
  analysisId?: string;
  lastDeployed: string;
  status: 'Live' | 'Building' | 'Failed' | 'Offline';
  url?: string;
  framework: 'React' | 'Vue' | 'Next.js' | 'Unknown';
}

export interface BuildLog {
  timestamp: string;
  message: string;
  type: 'info' | 'error' | 'success' | 'warning';
}

export interface GeminiRefactorResponse {
  originalCode: string;
  refactoredCode: string;
  explanation: string;
}
