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
  publicationSlug: string | null;
  addressSeed: string;
  publicationAddressError: string | null;
  isGeneratingAddress: boolean;
  addressGenerationFailed: boolean;
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
    setPublicationSlug: (slug: string | null) => void;
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
  publicationSlug: null,
  addressSeed: `app-${crypto.randomUUID().slice(0, 8)}`,
  publicationAddressError: null,
  isGeneratingAddress: false,
  addressGenerationFailed: false,
  apiKey: process.env.API_KEY || '',
  deploymentStatus: DeploymentStatus.IDLE,
  logs: [],

  actions: {
    setNewProjectId: (newProjectId) => set({ newProjectId }),
    setActiveProjectId: (activeProjectId) => set({ activeProjectId }),
    setIsPublishingNewProject: (isPublishingNewProject) => set({ isPublishingNewProject }),
    setStep: (step) => set({ step }),
    setSourceType: (sourceType) => set((state) => ({ sourceType, publicationAddressError: state.publicationSlug === null ? null : state.publicationAddressError })),
    setHtmlContent: (htmlContent) => set((state) => ({ htmlContent, publicationAddressError: state.publicationSlug === null ? null : state.publicationAddressError })),
    setRepoUrl: (repoUrl) => set((state) => ({ repoUrl, publicationAddressError: state.publicationSlug === null ? null : state.publicationAddressError })),
    setZipFile: (zipFile) => set((state) => ({ zipFile, publicationAddressError: state.publicationSlug === null ? null : state.publicationAddressError })),
    setProjectName: (projectName) => set((state) => ({ projectName, publicationAddressError: state.publicationSlug === null ? null : state.publicationAddressError })),
    setPublicationSlug: (publicationSlug) => set({ publicationSlug, publicationAddressError: null }),
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
      publicationSlug: null,
      addressSeed: `app-${crypto.randomUUID().slice(0, 8)}`,
      publicationAddressError: null,
      isGeneratingAddress: false,
      addressGenerationFailed: false,
      apiKey: process.env.API_KEY || '',
      deploymentStatus: DeploymentStatus.IDLE,
      logs: [],
      htmlContent: '',
    }),
  },
}));
