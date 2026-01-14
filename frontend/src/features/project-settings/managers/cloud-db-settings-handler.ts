import type { UIManager } from '@/managers/ui.manager';
import { useCloudDbSettingsStore } from '@/features/project-settings/stores/cloud-db-settings.store';
import i18n from '@/i18n/config';
import {
  deleteProjectCloudDbCollectionSecurityRules,
  getProjectCloudDbCollectionPermission,
  getProjectCloudDbCollectionSecurityRules,
  resetProjectCloudDbCollectionPermission,
  setProjectCloudDbCollectionPermission,
  setProjectCloudDbCollectionSecurityRules,
  type CloudDbPermissionMode,
  type SecurityRulesV0,
} from '@/services/http/cloud-db-settings-api';

function isValidCollectionName(raw: string): boolean {
  const value = raw.trim();
  if (!value) return false;
  if (value.length > 64) return false;
  return /^[a-z0-9][a-z0-9-_]*$/.test(value);
}

export class CloudDbSettingsHandler {
  constructor(private uiManager: UIManager) {}

  setProjectContext = (input: { projectId: string; appId: string }) => {
    const { actions } = useCloudDbSettingsStore.getState();
    actions.setProjectContext(input);
  };

  setCollection = (collection: string) => {
    const { actions } = useCloudDbSettingsStore.getState();
    actions.setCollection(collection);
  };

  load = async (): Promise<void> => {
    const t = i18n.t.bind(i18n);
    const state = useCloudDbSettingsStore.getState();
    const { actions } = state;

    if (!state.projectId) {
      actions.setError(t('project.cloudDbSettings.errors.missingProjectId', 'Missing project id.'));
      return;
    }
    if (!isValidCollectionName(state.collection)) {
      actions.setError(
        t('project.cloudDbSettings.errors.invalidCollection', 'Invalid collection name (lowercase letters/numbers/-/_).'),
      );
      return;
    }

    actions.setError(null);
    actions.setIsLoading(true);
    try {
      const [permission, rules] = await Promise.all([
        getProjectCloudDbCollectionPermission({
          projectId: state.projectId,
          collection: state.collection,
        }),
        getProjectCloudDbCollectionSecurityRules({
          projectId: state.projectId,
          collection: state.collection,
        }),
      ]);

      actions.setProjectContext({ projectId: permission.projectId, appId: permission.appId });
      actions.setPermissionState({ mode: permission.mode, updatedAt: permission.updatedAt });
      actions.setRulesState({ rules: rules.rules, updatedAt: rules.updatedAt });
    } catch (err) {
      actions.setError(err instanceof Error ? err.message : t('project.cloudDbSettings.errors.failedToLoad', 'Failed to load Cloud DB settings.'));
    } finally {
      actions.setIsLoading(false);
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
    if (!isValidCollectionName(state.collection)) {
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
        collection: state.collection,
        mode: state.permissionMode,
      });
      actions.setPermissionState({ mode: res.mode, updatedAt: res.updatedAt });
      this.uiManager.showSuccessToast(t('project.cloudDbSettings.toasts.permissionSaved', 'Cloud DB permission saved.'));
    } catch (err) {
      actions.setError(err instanceof Error ? err.message : t('project.cloudDbSettings.errors.failedToSavePermission', 'Failed to save permission.'));
      this.uiManager.showErrorToast(t('project.cloudDbSettings.errors.failedToSavePermission', 'Failed to save permission.'));
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
    if (!isValidCollectionName(state.collection)) {
      actions.setError(
        t('project.cloudDbSettings.errors.invalidCollection', 'Invalid collection name (lowercase letters/numbers/-/_).'),
      );
      return;
    }

    const confirmed = await this.uiManager.showConfirm({
      title: t('project.cloudDbSettings.confirmResetTitle', 'Reset permission?'),
      message: t('project.cloudDbSettings.confirmResetMessage', {
        collection: state.collection,
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
        collection: state.collection,
      });
      actions.setPermissionState({ mode: 'creator_read_write', updatedAt: null });
      this.uiManager.showSuccessToast(t('project.cloudDbSettings.toasts.permissionReset', 'Cloud DB permission reset to default.'));
    } catch (err) {
      actions.setError(err instanceof Error ? err.message : t('project.cloudDbSettings.errors.failedToResetPermission', 'Failed to reset permission.'));
      this.uiManager.showErrorToast(t('project.cloudDbSettings.errors.failedToResetPermission', 'Failed to reset permission.'));
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
    if (!isValidCollectionName(state.collection)) {
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
        collection: state.collection,
        rules: parsed,
      });
      actions.setRulesState({ rules: res.rules, updatedAt: res.updatedAt });
      this.uiManager.showSuccessToast(t('project.cloudDbSettings.toasts.rulesSaved', 'Cloud DB security rules saved.'));
    } catch (err) {
      actions.setError(err instanceof Error ? err.message : t('project.cloudDbSettings.errors.failedToSaveRules', 'Failed to save security rules.'));
      this.uiManager.showErrorToast(t('project.cloudDbSettings.errors.failedToSaveRules', 'Failed to save security rules.'));
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
    if (!isValidCollectionName(state.collection)) {
      actions.setError(
        t('project.cloudDbSettings.errors.invalidCollection', 'Invalid collection name (lowercase letters/numbers/-/_).'),
      );
      return;
    }

    const confirmed = await this.uiManager.showConfirm({
      title: t('project.cloudDbSettings.confirmRemoveRulesTitle', 'Remove rules?'),
      message: t('project.cloudDbSettings.confirmRemoveRulesMessage', {
        collection: state.collection,
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
        collection: state.collection,
      });
      actions.setRulesState({ rules: null, updatedAt: null });
      this.uiManager.showSuccessToast(t('project.cloudDbSettings.toasts.rulesRemoved', 'Cloud DB security rules removed.'));
    } catch (err) {
      actions.setError(err instanceof Error ? err.message : t('project.cloudDbSettings.errors.failedToRemoveRules', 'Failed to remove security rules.'));
      this.uiManager.showErrorToast(t('project.cloudDbSettings.errors.failedToRemoveRules', 'Failed to remove security rules.'));
    } finally {
      actions.setIsDeletingRules(false);
    }
  };
}
