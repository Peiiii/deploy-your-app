import { create } from 'zustand';
import type { CloudDbPermissionMode } from '@/services/http/cloud-db-settings-api';
import type { SecurityRulesV0 } from '@/services/http/cloud-db-settings-api';

interface CloudDbSettingsState {
  projectId: string | null;
  appId: string | null;

  collection: string;

  permissionMode: CloudDbPermissionMode;
  permissionUpdatedAt: number | null;

  rulesDraft: string;
  rulesUpdatedAt: number | null;
  hasRules: boolean;

  isLoading: boolean;
  isSavingPermission: boolean;
  isSavingRules: boolean;
  isDeletingRules: boolean;
  isResettingPermission: boolean;

  error: string | null;

  actions: {
    setProjectContext: (input: { projectId: string; appId: string }) => void;
    setCollection: (collection: string) => void;

    setPermissionMode: (mode: CloudDbPermissionMode) => void;
    setPermissionState: (input: { mode: CloudDbPermissionMode; updatedAt: number | null }) => void;

    setRulesDraft: (text: string) => void;
    setRulesState: (input: { rules: SecurityRulesV0 | null; updatedAt: number | null }) => void;

    setIsLoading: (value: boolean) => void;
    setIsSavingPermission: (value: boolean) => void;
    setIsSavingRules: (value: boolean) => void;
    setIsDeletingRules: (value: boolean) => void;
    setIsResettingPermission: (value: boolean) => void;

    setError: (error: string | null) => void;
    reset: () => void;
  };
}

const initialState = {
  projectId: null as string | null,
  appId: null as string | null,
  collection: 'posts',
  permissionMode: 'creator_read_write' as CloudDbPermissionMode,
  permissionUpdatedAt: null as number | null,
  rulesDraft: '',
  rulesUpdatedAt: null as number | null,
  hasRules: false,
  isLoading: false,
  isSavingPermission: false,
  isSavingRules: false,
  isDeletingRules: false,
  isResettingPermission: false,
  error: null as string | null,
};

export const useCloudDbSettingsStore = create<CloudDbSettingsState>((set) => ({
  ...initialState,
  actions: {
    setProjectContext: (input) => set({ projectId: input.projectId, appId: input.appId }),
    setCollection: (collection) => set({ collection }),
    setPermissionMode: (mode) => set({ permissionMode: mode }),
    setPermissionState: (input) => set({ permissionMode: input.mode, permissionUpdatedAt: input.updatedAt }),
    setRulesDraft: (text) => set({ rulesDraft: text }),
    setRulesState: (input) =>
      set({
        rulesDraft: input.rules ? JSON.stringify(input.rules, null, 2) : '',
        hasRules: Boolean(input.rules),
        rulesUpdatedAt: input.updatedAt,
      }),
    setIsLoading: (value) => set({ isLoading: value }),
    setIsSavingPermission: (value) => set({ isSavingPermission: value }),
    setIsSavingRules: (value) => set({ isSavingRules: value }),
    setIsDeletingRules: (value) => set({ isDeletingRules: value }),
    setIsResettingPermission: (value) => set({ isResettingPermission: value }),
    setError: (error) => set({ error }),
    reset: () => set(initialState),
  },
}));

