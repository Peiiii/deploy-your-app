import { create } from 'zustand';
import {
  apiConnectionRequest,
  type ApiConnection,
  type ApiConnectionSettings,
} from '@/services/http/api-connections-api';

interface ConnectionSettingsState {
  projectId: string | null;
  settings: ApiConnectionSettings | null;
  loading: boolean;
  busy: boolean;
  error: string | null;
  notice: 'saved' | 'tested' | 'deleted' | null;
  load: (projectId: string) => Promise<void>;
  saveSecret: (name: string, value: string) => Promise<boolean>;
  deleteSecret: (name: string) => Promise<boolean>;
  saveConnection: (connection: ApiConnection) => Promise<boolean>;
  test: (name: string) => Promise<boolean>;
}
let loadVersion = 0;
let mutationVersion = 0;
export const useApiConnectionsStore = create<ConnectionSettingsState>((set, get) => {
  const mutate = async (
    path: string,
    method: string,
    body: unknown,
    notice: ConnectionSettingsState['notice']
  ): Promise<boolean> => {
    const projectId = get().projectId;
    if (!projectId || get().busy) return false;
    const version = ++mutationVersion;
    const isCurrent = () => get().projectId === projectId && mutationVersion === version;
    set({ busy: true, error: null, notice: null });
    try {
      const result = await apiConnectionRequest<{ ok: boolean }>(projectId, path, method, body);
      if (!result.ok)
        throw new Error('The upstream connection test failed. Check the Key, URL and model.');
      if (!isCurrent()) return false;
      await get().load(projectId);
      if (!isCurrent()) return false;
      set({ notice });
      return true;
    } catch (error) {
      if (isCurrent()) set({ error: error instanceof Error ? error.message : 'Request failed.' });
      return false;
    } finally {
      if (isCurrent()) set({ busy: false });
    }
  };
  return {
    projectId: null,
    settings: null,
    loading: false,
    busy: false,
    error: null,
    notice: null,
    load: async (projectId) => {
      const version = ++loadVersion;
      if (get().projectId !== projectId) mutationVersion++;
      set({
        projectId,
        loading: true,
        error: null,
        ...(get().projectId !== projectId ? { settings: null, busy: false, notice: null } : {}),
      });
      try {
        const settings = await apiConnectionRequest<ApiConnectionSettings>(projectId);
        if (version === loadVersion) set({ settings, loading: false });
      } catch (error) {
        if (version === loadVersion)
          set({
            loading: false,
            error: error instanceof Error ? error.message : 'Unable to load API connections.',
          });
      }
    },
    saveSecret: (name, value) =>
      mutate(`secrets/${encodeURIComponent(name)}`, 'PUT', { value }, 'saved'),
    deleteSecret: (name) => mutate(`secrets/${encodeURIComponent(name)}`, 'DELETE', {}, 'deleted'),
    saveConnection: (connection) =>
      mutate(`api-connections/${encodeURIComponent(connection.name)}`, 'PUT', connection, 'saved'),
    test: (name) =>
      mutate(`api-connections/${encodeURIComponent(name)}/test`, 'POST', {}, 'tested'),
  };
});
