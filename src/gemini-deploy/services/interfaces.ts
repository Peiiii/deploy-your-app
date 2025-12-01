import type { Project, BuildLog } from '../types';
import { DeploymentStatus } from '../types';

export interface IProjectProvider {
  getProjects(): Promise<Project[]>;
  createProject(name: string, url: string, sourceType: 'github' | 'zip', identifier: string): Promise<Project>;
}

export interface IDeploymentProvider {
  analyzeCode(apiKey: string, sourceCode: string): Promise<{ refactoredCode: string; explanation: string }>;
  startDeployment(
    project: Project, 
    onLog: (log: BuildLog) => void, 
    onStatusChange: (status: DeploymentStatus) => void
  ): Promise<void>;
}
