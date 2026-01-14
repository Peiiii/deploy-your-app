import { create } from 'zustand';
import type {
  CloudDbCollectionSummary,
  CloudDbPermissionMode,
  SecurityRulesV0,
} from '@/services/http/cloud-db-settings-api';

interface CloudDbSettingsState {
  projectId: string | null;
  appId: string | null;

  collections: CloudDbCollectionSummary[];
  selectedCollection: string | null;

  permissionMode: CloudDbPermissionMode;
  permissionUpdatedAt: number | null;
  permissionIsOverridden: boolean;

  rulesDraft: string;
  rulesUpdatedAt: number | null;
  hasRules: boolean;

  isLoadingCollections: boolean;
  isLoadingCollection: boolean;
  isSavingPermission: boolean;
  isSavingRules: boolean;
  isDeletingRules: boolean;
  isResettingPermission: boolean;

  error: string | null;

  actions: {
    resetAll: () => void;
    setProjectContext: (input: { projectId: string; appId: string }) => void;

    setCollections: (collections: CloudDbCollectionSummary[]) => void;
    upsertLocalCollection: (collection: string) => void;
    setSelectedCollection: (collection: string | null) => void;

    setPermissionMode: (mode: CloudDbPermissionMode) => void;
    setPermissionState: (input: {
      mode: CloudDbPermissionMode;
      updatedAt: number | null;
      isOverridden: boolean;
    }) => void;

    setRulesDraft: (text: string) => void;
    setRulesState: (input: { rules: SecurityRulesV0 | null; updatedAt: number | null }) => void;

    setIsLoadingCollections: (value: boolean) => void;
    setIsLoadingCollection: (value: boolean) => void;
    setIsSavingPermission: (value: boolean) => void;
    setIsSavingRules: (value: boolean) => void;
    setIsDeletingRules: (value: boolean) => void;
    setIsResettingPermission: (value: boolean) => void;

    setError: (error: string | null) => void;
  };
}

const initialState = {
  projectId: null as string | null,
  appId: null as string | null,

  collections: [] as CloudDbCollectionSummary[],
  selectedCollection: null as string | null,

  permissionMode: 'creator_read_write' as CloudDbPermissionMode,
  permissionUpdatedAt: null as number | null,
  permissionIsOverridden: false,

  rulesDraft: '',
  rulesUpdatedAt: null as number | null,
  hasRules: false,

  isLoadingCollections: false,
  isLoadingCollection: false,
  isSavingPermission: false,
  isSavingRules: false,
  isDeletingRules: false,
  isResettingPermission: false,

  error: null as string | null,
};

export const useCloudDbSettingsStore = create<CloudDbSettingsState>((set) => ({
  ...initialState,
  actions: {
    resetAll: () => set(initialState),
    setProjectContext: (input) => set({ projectId: input.projectId, appId: input.appId }),

    setCollections: (collections) => set({ collections }),
    upsertLocalCollection: (collection) =>
      set((state) => {
        const normalized = collection.trim();
        if (!normalized) return state;
        const exists = state.collections.some((c) => c.collection === normalized);
        if (exists) return state;
        const next: CloudDbCollectionSummary = {
          collection: normalized,
          permission: { mode: 'creator_read_write', updatedAt: null, isOverridden: false },
          rules: { hasRules: false, updatedAt: null },
        };
        return { collections: [next, ...state.collections] };
      }),
    setSelectedCollection: (collection) =>
      set({
        selectedCollection: collection,
        permissionMode: 'creator_read_write',
        permissionUpdatedAt: null,
        permissionIsOverridden: false,
        rulesDraft: '',
        rulesUpdatedAt: null,
        hasRules: false,
        error: null,
      }),

    setPermissionMode: (mode) => set({ permissionMode: mode }),
    setPermissionState: (input) =>
      set({
        permissionMode: input.mode,
        permissionUpdatedAt: input.updatedAt,
        permissionIsOverridden: input.isOverridden,
      }),

    setRulesDraft: (text) => set({ rulesDraft: text }),
    setRulesState: (input) =>
      set({
        rulesDraft: input.rules ? JSON.stringify(input.rules, null, 2) : '',
        hasRules: Boolean(input.rules),
        rulesUpdatedAt: input.updatedAt,
      }),

    setIsLoadingCollections: (value) => set({ isLoadingCollections: value }),
    setIsLoadingCollection: (value) => set({ isLoadingCollection: value }),
    setIsSavingPermission: (value) => set({ isSavingPermission: value }),
    setIsSavingRules: (value) => set({ isSavingRules: value }),
    setIsDeletingRules: (value) => set({ isDeletingRules: value }),
    setIsResettingPermission: (value) => set({ isResettingPermission: value }),

    setError: (error) => set({ error }),
  },
}));

