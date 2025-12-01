import { create } from 'zustand';
import { DeploymentStatus } from '../types';
import type { BuildLog } from '../types';

// No default sample code – content should always come from the user's repo
// or from what the user manually pastes into the textarea.
export const DEFAULT_CODE_SNIPPET = '';

interface DeploymentState {
  step: number;
  sourceType: 'github' | 'zip';
  repoUrl: string;
  zipFile: File | null;
  projectName: string;
  apiKey: string;
  deploymentStatus: DeploymentStatus;
  logs: BuildLog[];
  sourceCode: string;
  // When analyzing a real repo, we track the backend session id and file path.
  analysisId: string;
  sourceFilePath: string;
  analyzedCode: string;
  explanation: string;
  isAnalyzing: boolean;
  
  actions: {
    setStep: (step: number) => void;
    setSourceType: (type: 'github' | 'zip') => void;
    setRepoUrl: (url: string) => void;
    setZipFile: (file: File | null) => void;
    setProjectName: (name: string) => void;
    setApiKey: (key: string) => void;
    setDeploymentStatus: (status: DeploymentStatus) => void;
    addLog: (log: BuildLog) => void;
    clearLogs: () => void;
    setSourceCode: (code: string) => void;
    setAnalysisId: (id: string) => void;
    setSourceFilePath: (path: string) => void;
    setAnalyzedCode: (code: string) => void;
    setExplanation: (text: string) => void;
    setIsAnalyzing: (isAnalyzing: boolean) => void;
    reset: () => void;
  };
}

export const useDeploymentStore = create<DeploymentState>((set) => ({
  step: 1,
  sourceType: 'github',
  repoUrl: '',
  zipFile: null,
  projectName: '',
  apiKey: process.env.API_KEY || '',
  deploymentStatus: DeploymentStatus.IDLE,
  logs: [],
  sourceCode: DEFAULT_CODE_SNIPPET,
  analysisId: '',
  sourceFilePath: '',
  analyzedCode: '',
  explanation: '',
  isAnalyzing: false,

  actions: {
    setStep: (step) => set({ step }),
    setSourceType: (sourceType) => set({ sourceType }),
    setRepoUrl: (repoUrl) => set({ repoUrl }),
    setZipFile: (zipFile) => set({ zipFile }),
    setProjectName: (projectName) => set({ projectName }),
    setApiKey: (apiKey) => set({ apiKey }),
    setDeploymentStatus: (deploymentStatus) => set({ deploymentStatus }),
    addLog: (log) => set((state) => ({ logs: [...state.logs, log] })),
    clearLogs: () => set({ logs: [] }),
    setSourceCode: (sourceCode) => set({ sourceCode }),
    setAnalysisId: (analysisId) => set({ analysisId }),
    setSourceFilePath: (sourceFilePath) => set({ sourceFilePath }),
    setAnalyzedCode: (analyzedCode) => set({ analyzedCode }),
    setExplanation: (explanation) => set({ explanation }),
    setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
    reset: () => set({
      step: 1,
      sourceType: 'github',
      repoUrl: '',
      zipFile: null,
      projectName: '',
      apiKey: process.env.API_KEY || '',
      deploymentStatus: DeploymentStatus.IDLE,
      logs: [],
      sourceCode: DEFAULT_CODE_SNIPPET,
      analysisId: '',
      sourceFilePath: '',
      analyzedCode: '',
      explanation: '',
      isAnalyzing: false,
    }),
  },
}));
