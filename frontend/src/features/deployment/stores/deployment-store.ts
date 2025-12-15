import { create } from 'zustand';
import { DeploymentStatus, SourceType } from '@/types';
import type { BuildLog } from '@/types';

interface DeploymentState {
  step: number;
  sourceType: SourceType;
  repoUrl: string;
  zipFile: File | null;
  projectName: string;
  apiKey: string;
  deploymentStatus: DeploymentStatus;
  logs: BuildLog[];
  htmlContent: string;

  actions: {
    setStep: (step: number) => void;
    setSourceType: (type: SourceType) => void;
    setHtmlContent: (html: string) => void;
    setRepoUrl: (url: string) => void;
    setZipFile: (file: File | null) => void;
    setProjectName: (name: string) => void;
    setApiKey: (key: string) => void;
    setDeploymentStatus: (status: DeploymentStatus) => void;
    addLog: (log: BuildLog) => void;
    clearLogs: () => void;
    reset: () => void;
  };
}

export const useDeploymentStore = create<DeploymentState>((set) => ({
  step: 1,
  sourceType: SourceType.GITHUB,
  htmlContent: '',
  repoUrl: '',
  zipFile: null,
  projectName: '',
  apiKey: process.env.API_KEY || '',
  deploymentStatus: DeploymentStatus.IDLE,
  logs: [],

  actions: {
    setStep: (step) => set({ step }),
    setSourceType: (sourceType) => set({ sourceType }),
    setHtmlContent: (htmlContent) => set({ htmlContent }),
    setRepoUrl: (repoUrl) => set({ repoUrl }),
    setZipFile: (zipFile) => set({ zipFile }),
    setProjectName: (projectName) => set({ projectName }),
    setApiKey: (apiKey) => set({ apiKey }),
    setDeploymentStatus: (deploymentStatus) => set({ deploymentStatus }),
    addLog: (log) => set((state) => ({ logs: [...state.logs, log] })),
    clearLogs: () => set({ logs: [] }),
    reset: () => set({
      step: 1,
      sourceType: SourceType.GITHUB,
      repoUrl: '',
      zipFile: null,
      projectName: '',
      apiKey: process.env.API_KEY || '',
      deploymentStatus: DeploymentStatus.IDLE,
      logs: [],
      htmlContent: '',
    }),
  },
}));
