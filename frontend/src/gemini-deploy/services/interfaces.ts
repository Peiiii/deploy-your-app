import type { Project, BuildLog } from '../types';
import { DeploymentStatus } from '../types';

export interface AnalyzeCodeParams {
  apiKey: string;
  // Optional snippet the user provided/edited in the UI.
  sourceCode?: string;
  // Optional GitHub URL, used by the backend to clone and inspect the real repo.
  repoUrl?: string;
  // Optional existing analysis session id to reuse cloned repo.
  analysisId?: string;
}

export interface AnalyzeCodeResult {
  refactoredCode: string;
  explanation: string;
  // Id for the backend analysis session / cloned repo.
  analysisId?: string;
  // The concrete file path inside the repo that was analyzed.
  sourceFilePath?: string;
  // The original code that the platform AI saw (from the repo or the snippet).
  originalCode?: string;
}

export interface IProjectProvider {
  getProjects(): Promise<Project[]>;
  createProject(
    name: string,
    url: string,
    sourceType: 'github' | 'zip',
    identifier: string,
  ): Promise<Project>;
}

export interface IDeploymentProvider {
  analyzeCode(params: AnalyzeCodeParams): Promise<AnalyzeCodeResult>;
  startDeployment(
    project: Project,
    onLog: (log: BuildLog) => void,
    onStatusChange: (status: DeploymentStatus) => void,
  ): Promise<void>;
}
