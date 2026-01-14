import type { UIManager } from '@/managers/ui.manager';
import { useCloudDbSettingsStore } from '@/features/project-settings/stores/cloud-db-settings.store';
import i18n from '@/i18n/config';
import {
  deleteProjectCloudDbCollectionSecurityRules,
  ensureProjectCloudDbCollection,
  getProjectCloudDbCollectionFields,
  getProjectCloudDbCollectionPermission,
  getProjectCloudDbCollectionSecurityRules,
  listProjectCloudDbCollections,
  resetProjectCloudDbCollectionPermission,
  setProjectCloudDbCollectionPermission,
  setProjectCloudDbCollectionSecurityRules,
  type CloudDbCollectionSummary,
  type CloudDbPermissionMode,
  type SecurityRulesV0,
} from '@/services/http/cloud-db-settings-api';

function isValidCollectionName(raw: string): boolean {
  const value = raw.trim();
  if (!value) return false;
  if (value.length > 64) return false;
  return /^[a-z0-9][a-z0-9-_]*$/.test(value);
}

function mergeCollections(input: {
  server: CloudDbCollectionSummary[];
  existing: CloudDbCollectionSummary[];
}): CloudDbCollectionSummary[] {
  const serverByName = new Map<string, CloudDbCollectionSummary>();
  input.server.forEach((c) => serverByName.set(c.collection, c));

  const merged: CloudDbCollectionSummary[] = [...input.server];
  input.existing.forEach((c) => {
    if (serverByName.has(c.collection)) return;
    merged.push(c);
  });
  return merged;
}

export class CloudDbSettingsHandler {
  constructor(private uiManager: UIManager) {}

  setProjectContext = (input: { projectId: string; appId: string }) => {
    const { actions } = useCloudDbSettingsStore.getState();
    actions.setProjectContext(input);
  };

  loadCollections = async (): Promise<void> => {
    const t = i18n.t.bind(i18n);
    const state = useCloudDbSettingsStore.getState();
    const { actions } = state;

    if (!state.projectId) {
      actions.setError(t('project.cloudDbSettings.errors.missingProjectId', 'Missing project id.'));
      return;
    }

    actions.setError(null);
    actions.setIsLoadingCollections(true);
    try {
      const res = await listProjectCloudDbCollections({ projectId: state.projectId });
      actions.setProjectContext({ projectId: res.projectId, appId: res.appId });
      actions.setCollections(
        mergeCollections({
          server: res.items,
          existing: useCloudDbSettingsStore.getState().collections,
        }),
      );
    } catch (err) {
      actions.setError(
        err instanceof Error
          ? err.message
          : t('project.cloudDbSettings.errors.failedToLoad', 'Failed to load Cloud DB settings.'),
      );
    } finally {
      actions.setIsLoadingCollections(false);
    }
  };

  addCollection = async (collectionRaw: string): Promise<void> => {
    const t = i18n.t.bind(i18n);
    const { actions } = useCloudDbSettingsStore.getState();
    const collection = collectionRaw.trim();

    if (!isValidCollectionName(collection)) {
      actions.setError(
        t('project.cloudDbSettings.errors.invalidCollection', 'Invalid collection name (lowercase letters/numbers/-/_).'),
      );
      return;
    }

    actions.setError(null);
    actions.upsertLocalCollection(collection);
    actions.setSelectedCollection(collection);
    try {
      const state = useCloudDbSettingsStore.getState();
      if (!state.projectId) {
        actions.setError(t('project.cloudDbSettings.errors.missingProjectId', 'Missing project id.'));
        return;
      }
      await ensureProjectCloudDbCollection({ projectId: state.projectId, collection });
    } catch (err) {
      actions.setError(err instanceof Error ? err.message : 'Failed to create Cloud DB collection');
      return;
    }

    await this.loadCollections();
    await this.loadSelectedCollection();
  };

  selectCollection = async (collectionRaw: string): Promise<void> => {
    const t = i18n.t.bind(i18n);
    const state = useCloudDbSettingsStore.getState();
    const { actions } = state;
    const collection = collectionRaw.trim();

    if (!collection) return;
    if (!isValidCollectionName(collection)) {
      actions.setError(
        t('project.cloudDbSettings.errors.invalidCollection', 'Invalid collection name (lowercase letters/numbers/-/_).'),
      );
      return;
    }

    actions.setError(null);
    actions.setSelectedCollection(collection);
    await this.loadSelectedCollection();
  };

  loadSelectedCollection = async (): Promise<void> => {
    const t = i18n.t.bind(i18n);
    const state = useCloudDbSettingsStore.getState();
    const { actions } = state;

    if (!state.projectId) {
      actions.setError(t('project.cloudDbSettings.errors.missingProjectId', 'Missing project id.'));
      return;
    }
    if (!state.selectedCollection) return;
    if (!isValidCollectionName(state.selectedCollection)) {
      actions.setError(
        t('project.cloudDbSettings.errors.invalidCollection', 'Invalid collection name (lowercase letters/numbers/-/_).'),
      );
      return;
    }

    actions.setError(null);
    actions.setIsLoadingCollection(true);
    actions.setIsLoadingFields(true);
    try {
      const collection = state.selectedCollection;
      const [permission, rules, fieldsRes] = await Promise.all([
        getProjectCloudDbCollectionPermission({ projectId: state.projectId, collection }),
        getProjectCloudDbCollectionSecurityRules({ projectId: state.projectId, collection }),
        getProjectCloudDbCollectionFields({ projectId: state.projectId, collection, sample: 50 }),
      ]);

      actions.setProjectContext({ projectId: permission.projectId, appId: permission.appId });
      actions.setPermissionState({
        mode: permission.mode,
        updatedAt: permission.updatedAt,
        isOverridden: permission.updatedAt !== null,
      });
      actions.setRulesState({ rules: rules.rules, updatedAt: rules.updatedAt });
      actions.setFieldsState({
        fields: fieldsRes.fields,
        inferredAt: fieldsRes.inferredAt,
        totalDocs: fieldsRes.totalDocs,
        sampledDocs: fieldsRes.sampledDocs,
      });

      const nextSummary: CloudDbCollectionSummary = {
        collection,
        permission: {
          mode: permission.mode,
          updatedAt: permission.updatedAt,
          isOverridden: permission.updatedAt !== null,
        },
        rules: { hasRules: Boolean(rules.rules), updatedAt: rules.updatedAt },
      };
      const current = useCloudDbSettingsStore.getState().collections;
      const exists = current.some((c) => c.collection === collection);
      const nextCollections = exists
        ? current.map((c) => (c.collection === collection ? nextSummary : c))
        : [nextSummary, ...current];
      actions.setCollections(nextCollections);
    } catch (err) {
      actions.setError(
        err instanceof Error
          ? err.message
          : t('project.cloudDbSettings.errors.failedToLoad', 'Failed to load Cloud DB settings.'),
      );
    } finally {
      actions.setIsLoadingCollection(false);
      actions.setIsLoadingFields(false);
    }
  };

  setPermissionMode = (mode: CloudDbPermissionMode) => {
    const { actions } = useCloudDbSettingsStore.getState();
    actions.setPermissionMode(mode);
  };

  savePermission = async (): Promise<void> => {
    const t = i18n.t.bind(i18n);
    const state = useCloudDbSettingsStore.getState();
    const { actions } = state;

    if (!state.projectId) {
      actions.setError(t('project.cloudDbSettings.errors.missingProjectId', 'Missing project id.'));
      return;
    }
    if (!state.selectedCollection) return;
    if (!isValidCollectionName(state.selectedCollection)) {
      actions.setError(
        t('project.cloudDbSettings.errors.invalidCollection', 'Invalid collection name (lowercase letters/numbers/-/_).'),
      );
      return;
    }

    actions.setError(null);
    actions.setIsSavingPermission(true);
    try {
      const res = await setProjectCloudDbCollectionPermission({
        projectId: state.projectId,
        collection: state.selectedCollection,
        mode: state.permissionMode,
      });
      actions.setPermissionState({ mode: res.mode, updatedAt: res.updatedAt, isOverridden: true });
      this.uiManager.showSuccessToast(
        t('project.cloudDbSettings.toasts.permissionSaved', 'Cloud DB permission saved.'),
      );
      await this.loadCollections();
    } catch (err) {
      actions.setError(
        err instanceof Error
          ? err.message
          : t('project.cloudDbSettings.errors.failedToSavePermission', 'Failed to save permission.'),
      );
      this.uiManager.showErrorToast(
        t('project.cloudDbSettings.errors.failedToSavePermission', 'Failed to save permission.'),
      );
    } finally {
      actions.setIsSavingPermission(false);
    }
  };

  resetPermission = async (): Promise<void> => {
    const t = i18n.t.bind(i18n);
    const state = useCloudDbSettingsStore.getState();
    const { actions } = state;

    if (!state.projectId) {
      actions.setError(t('project.cloudDbSettings.errors.missingProjectId', 'Missing project id.'));
      return;
    }
    if (!state.selectedCollection) return;
    if (!isValidCollectionName(state.selectedCollection)) {
      actions.setError(
        t('project.cloudDbSettings.errors.invalidCollection', 'Invalid collection name (lowercase letters/numbers/-/_).'),
      );
      return;
    }

    const confirmed = await this.uiManager.showConfirm({
      title: t('project.cloudDbSettings.confirmResetTitle', 'Reset permission?'),
      message: t('project.cloudDbSettings.confirmResetMessage', {
        collection: state.selectedCollection,
        defaultValue: 'Reset legacy permission mode to default for collection "{{collection}}"? This does not remove Security Rules.',
      }),
      primaryLabel: t('project.cloudDbSettings.reset', 'Reset'),
      secondaryLabel: t('common.cancel', 'Cancel'),
    });
    if (!confirmed) return;

    actions.setError(null);
    actions.setIsResettingPermission(true);
    try {
      await resetProjectCloudDbCollectionPermission({
        projectId: state.projectId,
        collection: state.selectedCollection,
      });
      actions.setPermissionState({
        mode: 'creator_read_write',
        updatedAt: null,
        isOverridden: false,
      });
      this.uiManager.showSuccessToast(
        t('project.cloudDbSettings.toasts.permissionReset', 'Cloud DB permission reset to default.'),
      );
      await this.loadCollections();
    } catch (err) {
      actions.setError(
        err instanceof Error
          ? err.message
          : t('project.cloudDbSettings.errors.failedToResetPermission', 'Failed to reset permission.'),
      );
      this.uiManager.showErrorToast(
        t('project.cloudDbSettings.errors.failedToResetPermission', 'Failed to reset permission.'),
      );
    } finally {
      actions.setIsResettingPermission(false);
    }
  };

  setRulesDraft = (text: string) => {
    const { actions } = useCloudDbSettingsStore.getState();
    actions.setRulesDraft(text);
  };

  applyRulesTemplate = (template: 'public_feed_or_owner' | 'owner_only') => {
    const { actions } = useCloudDbSettingsStore.getState();
    const rules: SecurityRulesV0 =
      template === 'owner_only'
        ? {
            version: 0,
            read: { allOf: [{ field: '_openid', op: '==', value: { var: 'auth.openid' } }] },
            write: { allOf: [{ field: '_openid', op: '==', value: { var: 'auth.openid' } }] },
          }
        : {
            version: 0,
            read: {
              anyOf: [
                { allOf: [{ field: 'visibility', op: '==', value: 'public' }] },
                { allOf: [{ field: '_openid', op: '==', value: { var: 'auth.openid' } }] },
              ],
            },
            write: { allOf: [{ field: '_openid', op: '==', value: { var: 'auth.openid' } }] },
          };

    actions.setRulesState({ rules, updatedAt: null });
  };

  formatRulesDraft = (): void => {
    const t = i18n.t.bind(i18n);
    const state = useCloudDbSettingsStore.getState();
    const { actions } = state;

    const trimmed = state.rulesDraft.trim();
    if (!trimmed) return;

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      actions.setRulesDraft(JSON.stringify(parsed, null, 2));
      actions.setError(null);
    } catch {
      actions.setError(t('project.cloudDbSettings.errors.invalidRulesJson', 'Rules JSON is invalid.'));
      this.uiManager.showErrorToast(t('project.cloudDbSettings.errors.invalidRulesJson', 'Rules JSON is invalid.'));
    }
  };

  saveRules = async (): Promise<void> => {
    const t = i18n.t.bind(i18n);
    const state = useCloudDbSettingsStore.getState();
    const { actions } = state;

    if (!state.projectId) {
      actions.setError(t('project.cloudDbSettings.errors.missingProjectId', 'Missing project id.'));
      return;
    }
    if (!state.selectedCollection) return;
    if (!isValidCollectionName(state.selectedCollection)) {
      actions.setError(
        t('project.cloudDbSettings.errors.invalidCollection', 'Invalid collection name (lowercase letters/numbers/-/_).'),
      );
      return;
    }

    let parsed: SecurityRulesV0;
    try {
      parsed = JSON.parse(state.rulesDraft) as SecurityRulesV0;
    } catch {
      actions.setError(t('project.cloudDbSettings.errors.invalidRulesJson', 'Rules JSON is invalid.'));
      return;
    }

    actions.setError(null);
    actions.setIsSavingRules(true);
    try {
      const res = await setProjectCloudDbCollectionSecurityRules({
        projectId: state.projectId,
        collection: state.selectedCollection,
        rules: parsed,
      });
      actions.setRulesState({ rules: res.rules, updatedAt: res.updatedAt });
      this.uiManager.showSuccessToast(
        t('project.cloudDbSettings.toasts.rulesSaved', 'Cloud DB security rules saved.'),
      );
      await this.loadCollections();
    } catch (err) {
      actions.setError(
        err instanceof Error
          ? err.message
          : t('project.cloudDbSettings.errors.failedToSaveRules', 'Failed to save security rules.'),
      );
      this.uiManager.showErrorToast(
        t('project.cloudDbSettings.errors.failedToSaveRules', 'Failed to save security rules.'),
      );
    } finally {
      actions.setIsSavingRules(false);
    }
  };

  deleteRules = async (): Promise<void> => {
    const t = i18n.t.bind(i18n);
    const state = useCloudDbSettingsStore.getState();
    const { actions } = state;

    if (!state.projectId) {
      actions.setError(t('project.cloudDbSettings.errors.missingProjectId', 'Missing project id.'));
      return;
    }
    if (!state.selectedCollection) return;
    if (!isValidCollectionName(state.selectedCollection)) {
      actions.setError(
        t('project.cloudDbSettings.errors.invalidCollection', 'Invalid collection name (lowercase letters/numbers/-/_).'),
      );
      return;
    }

    const confirmed = await this.uiManager.showConfirm({
      title: t('project.cloudDbSettings.confirmRemoveRulesTitle', 'Remove rules?'),
      message: t('project.cloudDbSettings.confirmRemoveRulesMessage', {
        collection: state.selectedCollection,
        defaultValue: 'Remove Security Rules for collection "{{collection}}"? Legacy permission mode will apply again.',
      }),
      primaryLabel: t('project.cloudDbSettings.removeRules', 'Remove rules'),
      secondaryLabel: t('common.cancel', 'Cancel'),
    });
    if (!confirmed) return;

    actions.setError(null);
    actions.setIsDeletingRules(true);
    try {
      await deleteProjectCloudDbCollectionSecurityRules({
        projectId: state.projectId,
        collection: state.selectedCollection,
      });
      actions.setRulesState({ rules: null, updatedAt: null });
      this.uiManager.showSuccessToast(
        t('project.cloudDbSettings.toasts.rulesRemoved', 'Cloud DB security rules removed.'),
      );
      await this.loadCollections();
    } catch (err) {
      actions.setError(
        err instanceof Error
          ? err.message
          : t('project.cloudDbSettings.errors.failedToRemoveRules', 'Failed to remove security rules.'),
      );
      this.uiManager.showErrorToast(
        t('project.cloudDbSettings.errors.failedToRemoveRules', 'Failed to remove security rules.'),
      );
    } finally {
      actions.setIsDeletingRules(false);
    }
  };
}
