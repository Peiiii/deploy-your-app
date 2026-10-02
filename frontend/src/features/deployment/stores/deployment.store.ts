import { create } from 'zustand';
import { DeploymentStatus, SourceType } from '@/types';
import type { BuildLog } from '@/types';

interface DeploymentState {
  newProjectId: string | null;
  activeProjectId: string | null;
  isPublishingNewProject: boolean;
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
    setNewProjectId: (id: string | null) => void;
    setActiveProjectId: (id: string | null) => void;
    setIsPublishingNewProject: (value: boolean) => void;
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
  newProjectId: null,
  activeProjectId: null,
  isPublishingNewProject: false,
  step: 1,
  sourceType: SourceType.HTML,
  htmlContent: '',
  repoUrl: '',
  zipFile: null,
  projectName: '',
  apiKey: process.env.API_KEY || '',
  deploymentStatus: DeploymentStatus.IDLE,
  logs: [],

  actions: {
    setNewProjectId: (newProjectId) => set({ newProjectId }),
    setActiveProjectId: (activeProjectId) => set({ activeProjectId }),
    setIsPublishingNewProject: (isPublishingNewProject) => set({ isPublishingNewProject }),
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
      newProjectId: null,
      activeProjectId: null,
      isPublishingNewProject: false,
      step: 1,
      sourceType: SourceType.HTML,
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
