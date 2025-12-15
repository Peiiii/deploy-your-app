import { create } from 'zustand';
import type { Project } from '../types';

interface ProjectSettingsState {
  // 当前编辑的项目 ID
  projectId: string | null;

  // 表单草稿状态
  nameDraft: string;
  descriptionDraft: string;
  categoryDraft: string;
  tagsDraft: string;
  repoUrlDraft: string;
  slugDraft: string;

  // 操作状态
  isSavingRepoUrl: boolean;
  isSavingMetadata: boolean;
  isRedeploying: boolean;
  isDeployingHtml: boolean;
  zipUploading: boolean;
  htmlUploading: boolean;
  isUploadingThumbnail: boolean;

  // 缩略图版本（用于缓存失效）
  thumbnailVersion: number;

  // 错误信息
  error: string | null;

  // Actions
  actions: {
    setProjectId: (id: string | null) => void;
    setNameDraft: (value: string) => void;
    setDescriptionDraft: (value: string) => void;
    setCategoryDraft: (value: string) => void;
    setTagsDraft: (value: string) => void;
    setRepoUrlDraft: (value: string) => void;
    setSlugDraft: (value: string) => void;
    setIsSavingRepoUrl: (value: boolean) => void;
    setIsSavingMetadata: (value: boolean) => void;
    setIsRedeploying: (value: boolean) => void;
    setIsDeployingHtml: (value: boolean) => void;
    setZipUploading: (value: boolean) => void;
    setHtmlUploading: (value: boolean) => void;
    setIsUploadingThumbnail: (value: boolean) => void;
    bumpThumbnailVersion: () => void;
    setError: (error: string | null) => void;
    resetForm: () => void;
    initializeFromProject: (project: Project) => void;
  };
}

const initialFormState = {
  projectId: null as string | null,
  nameDraft: '',
  descriptionDraft: '',
  categoryDraft: '',
  tagsDraft: '',
  repoUrlDraft: '',
  slugDraft: '',
  isSavingRepoUrl: false,
  isSavingMetadata: false,
  isRedeploying: false,
  isDeployingHtml: false,
  zipUploading: false,
  htmlUploading: false,
  isUploadingThumbnail: false,
  thumbnailVersion: 0,
  error: null as string | null,
};

export const useProjectSettingsStore = create<ProjectSettingsState>((set) => ({
  ...initialFormState,

  actions: {
    setProjectId: (id) => set({ projectId: id }),
    setNameDraft: (value) => set({ nameDraft: value }),
    setDescriptionDraft: (value) => set({ descriptionDraft: value }),
    setCategoryDraft: (value) => set({ categoryDraft: value }),
    setTagsDraft: (value) => set({ tagsDraft: value }),
    setRepoUrlDraft: (value) => set({ repoUrlDraft: value }),
    setSlugDraft: (value) => set({ slugDraft: value }),
    setIsSavingRepoUrl: (value) => set({ isSavingRepoUrl: value }),
    setIsSavingMetadata: (value) => set({ isSavingMetadata: value }),
    setIsRedeploying: (value) => set({ isRedeploying: value }),
    setIsDeployingHtml: (value) => set({ isDeployingHtml: value }),
    setZipUploading: (value) => set({ zipUploading: value }),
    setHtmlUploading: (value) => set({ htmlUploading: value }),
    setIsUploadingThumbnail: (value) => set({ isUploadingThumbnail: value }),
    bumpThumbnailVersion: () =>
      set((state) => ({ thumbnailVersion: state.thumbnailVersion + 1 })),
    setError: (error) => set({ error }),
    resetForm: () => set(initialFormState),
    initializeFromProject: (project) =>
      set({
        projectId: project.id,
        nameDraft: project.name || '',
        descriptionDraft: project.description || '',
        categoryDraft: project.category || '',
        tagsDraft:
          project.tags && project.tags.length > 0
            ? project.tags.join(', ')
            : '',
        repoUrlDraft:
          project.repoUrl && project.repoUrl.startsWith('draft:')
            ? ''
            : project.repoUrl || '',
        slugDraft: project.slug || '',
        error: null,
      }),
  },
}));
