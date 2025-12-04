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
  // Optional base64-encoded ZIP content for one-off deployments when sourceType === 'zip'.
  // This is only used for the deployment job and is not persisted in the project list.
  zipData?: string;
  // Optional analysis session id that links this project to a prepared repo on the backend
  analysisId?: string;
  lastDeployed: string;
  status: 'Live' | 'Building' | 'Failed' | 'Offline';
  url?: string;
  framework: 'React' | 'Vue' | 'Next.js' | 'Unknown';
  // High-level category used by Explore Apps (e.g. "Development", "Image Gen").
  category?: string;
   // Optional tags for finer-grained filtering/search (e.g. ["chatbot", "landing-page"]).
  tags?: string[];
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
