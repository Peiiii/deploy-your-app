import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import type { Project } from '@/types';
import { usePresenter } from '@/contexts/presenter-context';
import { useCloudDbSettingsStore } from '@/features/project-settings/stores/cloud-db-settings.store';
import type { CloudDbPermissionMode } from '@/services/http/cloud-db-settings-api';

function deriveAppIdFromSlug(slugRaw: string | undefined): string | null {
  const slug = (slugRaw ?? '').trim();
  if (!slug) return null;
  return slug;
}

export const SettingsCloudDbTab: React.FC<{ project: Project }> = ({ project }) => {
  const { t } = useTranslation();
  const [, setSearchParams] = useSearchParams();
  const presenter = usePresenter();
  const {
    appId,
    collection,
    permissionMode,
    permissionUpdatedAt,
    rulesDraft,
    rulesUpdatedAt,
    hasRules,
    isLoading,
    isSavingPermission,
    isResettingPermission,
    isSavingRules,
    isDeletingRules,
    error,
  } = useCloudDbSettingsStore();
  const actions = useCloudDbSettingsStore((s) => s.actions);

  const derivedAppId = deriveAppIdFromSlug(project.slug);
  const slugMissing = !derivedAppId;

  useEffect(() => {
    if (!derivedAppId) {
      actions.setProjectContext({ projectId: project.id, appId: '-' });
      actions.setError(null);
      return;
    }

    presenter.projectSettings.cloudDbSetProjectContext({ projectId: project.id, appId: derivedAppId });
    void presenter.projectSettings.cloudDbLoad();
  }, [project.id, derivedAppId, presenter.projectSettings, actions]);

  const disableAll = slugMissing || isLoading || isSavingPermission || isSavingRules || isDeletingRules || isResettingPermission;
  const mode = permissionMode as CloudDbPermissionMode;

  const goToGeneral = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', 'general');
      return next;
    });
  };

  if (slugMissing) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              {t('project.cloudDbSettings.title', 'Cloud DB')}
            </h2>
          </div>
          <div className="p-6 space-y-3">
            <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-200">
              {t(
                'project.cloudDbSettings.slugRequiredMessage',
                'Project slug is required (it becomes appId for Cloud DB). Please set a slug first.',
              )}
            </div>
            <div>
              <button
                type="button"
                className="px-3 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700"
                onClick={goToGeneral}
              >
                {t('project.cloudDbSettings.goToGeneral', 'Go to General')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            {t('project.cloudDbSettings.title', 'Cloud DB')}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t(
              'project.cloudDbSettings.description',
              'Configure collection permission and Security Rules (wx.cloud aligned). Rules take precedence when present.',
            )}
          </p>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {t('project.cloudDbSettings.projectLabel', 'Project')}
              </div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">{project.name}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {t('project.cloudDbSettings.appIdLabel', 'appId')}
              </div>
              <div className="text-sm font-mono text-slate-900 dark:text-white">{appId ?? '-'}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {t('project.cloudDbSettings.collectionLabel', 'Collection')}
              </div>
              <div className="flex gap-2">
                <input
                  value={collection}
                  onChange={(e) => presenter.projectSettings.cloudDbSetCollection(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  placeholder="posts"
                />
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                  onClick={presenter.projectSettings.cloudDbLoad}
                  disabled={disableAll}
                >
                  {t('project.cloudDbSettings.load', 'Load')}
                </button>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {t('project.cloudDbSettings.collectionHint', 'Must be lowercase letters/numbers with - / _.')}
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {isLoading && (
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {t('project.cloudDbSettings.loading', 'Loading…')}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            {t('project.cloudDbSettings.legacyTitle', 'Legacy Permission Mode')}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t(
              'project.cloudDbSettings.legacyDescription',
              'Applies only when Security Rules are not configured for this collection.',
            )}
          </p>
        </div>
        <div className="p-6 space-y-3">
          {hasRules && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-200">
              {t(
                'project.cloudDbSettings.legacyIgnoredHint',
                'Security Rules are enabled for this collection; legacy permission is ignored.',
              )}
            </div>
          )}
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <select
              value={mode}
              onChange={(e) => presenter.projectSettings.cloudDbSetPermissionMode(e.target.value as CloudDbPermissionMode)}
              disabled={disableAll}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            >
              <option value="creator_read_write">
                {t('project.cloudDbSettings.permissionModes.creator_read_write', 'Only creator can read/write (default)')}
              </option>
              <option value="all_read_creator_write">
                {t('project.cloudDbSettings.permissionModes.all_read_creator_write', 'All users can read, only creator can write')}
              </option>
              <option value="all_read_readonly">
                {t('project.cloudDbSettings.permissionModes.all_read_readonly', 'All users can read, nobody can write')}
              </option>
              <option value="none">
                {t('project.cloudDbSettings.permissionModes.none', 'Disabled (no read/write)')}
              </option>
            </select>
            <div className="flex gap-2">
              <button
                type="button"
                className="px-3 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60"
                onClick={presenter.projectSettings.cloudDbSavePermission}
                disabled={disableAll}
              >
                {t('common.save', 'Save')}
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
                onClick={presenter.projectSettings.cloudDbResetPermission}
                disabled={disableAll}
              >
                {t('project.cloudDbSettings.reset', 'Reset')}
              </button>
            </div>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {t('project.cloudDbSettings.updatedLabel', 'Updated')}:{' '}
            {permissionUpdatedAt
              ? new Date(permissionUpdatedAt).toLocaleString()
              : t('project.cloudDbSettings.updatedDefault', 'default')}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            {t('project.cloudDbSettings.rulesTitle', 'Security Rules (Recommended)')}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t(
              'project.cloudDbSettings.rulesDescription',
              'When enabled, queries must include the equality constraints of at least one rules branch (no silent filtering).',
            )}
          </p>
        </div>

        <div className="p-6 space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="px-3 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
              onClick={() => presenter.projectSettings.cloudDbApplyRulesTemplate('public_feed_or_owner')}
              disabled={disableAll}
              title={t(
                'project.cloudDbSettings.templatePublicFeedOrOwnerHelp',
                "Public feed: visibility=='public' OR owner; Write: owner",
              )}
            >
              {t('project.cloudDbSettings.templatePublicFeedOrOwner', 'Template: Public feed + owner')}
            </button>
            <button
              type="button"
              className="px-3 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
              onClick={() => presenter.projectSettings.cloudDbApplyRulesTemplate('owner_only')}
              disabled={disableAll}
              title={t('project.cloudDbSettings.templateOwnerOnlyHelp', 'Owner-only read/write')}
            >
              {t('project.cloudDbSettings.templateOwnerOnly', 'Template: Owner only')}
            </button>
            <button
              type="button"
              className="px-3 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
              onClick={presenter.projectSettings.cloudDbFormatRulesDraft}
              disabled={disableAll || rulesDraft.trim().length === 0}
            >
              {t('project.cloudDbSettings.formatJson', 'Format JSON')}
            </button>
          </div>

          <textarea
            value={rulesDraft}
            onChange={(e) => presenter.projectSettings.cloudDbSetRulesDraft(e.target.value)}
            disabled={disableAll}
            className="w-full min-h-[220px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm font-mono"
            placeholder='{"version":0,"read":{"allOf":[{"field":"_openid","op":"==","value":{"var":"auth.openid"}}]},"write":{"allOf":[{"field":"_openid","op":"==","value":{"var":"auth.openid"}}]}}'
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="px-3 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60"
              onClick={presenter.projectSettings.cloudDbSaveRules}
              disabled={disableAll || rulesDraft.trim().length === 0}
            >
              {t('project.cloudDbSettings.saveRules', 'Save rules')}
            </button>
            <button
              type="button"
              className="px-3 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
              onClick={presenter.projectSettings.cloudDbDeleteRules}
              disabled={disableAll || !hasRules}
            >
              {t('project.cloudDbSettings.removeRules', 'Remove rules')}
            </button>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400">
            {t('project.cloudDbSettings.rulesStatusLabel', 'Rules')}:{' '}
            {hasRules
              ? t('project.cloudDbSettings.rulesStatusEnabled', 'enabled')
              : t('project.cloudDbSettings.rulesStatusNotSet', 'not set')}
            ; {t('project.cloudDbSettings.updatedLabel', 'Updated')}:{' '}
            {rulesUpdatedAt ? new Date(rulesUpdatedAt).toLocaleString() : '-'}
          </div>
        </div>
      </div>
    </div>
  );
};
