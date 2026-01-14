import React, { useEffect, useMemo, useState } from 'react';
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

function isValidCollectionName(raw: string): boolean {
  const value = raw.trim();
  if (!value) return false;
  if (value.length > 64) return false;
  return /^[a-z0-9][a-z0-9-_]*$/.test(value);
}

export const SettingsCloudDbTab: React.FC<{ project: Project }> = ({ project }) => {
  const { t } = useTranslation();
  const [, setSearchParams] = useSearchParams();
  const presenter = usePresenter();

  const [newCollectionDraft, setNewCollectionDraft] = useState('');

  const {
    appId,
    collections,
    selectedCollection,
    permissionMode,
    permissionUpdatedAt,
    permissionIsOverridden,
    rulesDraft,
    rulesUpdatedAt,
    hasRules,
    isLoadingCollections,
    isLoadingCollection,
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
    actions.resetAll();
    if (!derivedAppId) {
      actions.setProjectContext({ projectId: project.id, appId: '-' });
      actions.setError(null);
      return;
    }

    presenter.projectSettings.cloudDbSetProjectContext({
      projectId: project.id,
      appId: derivedAppId,
    });
    presenter.projectSettings.cloudDbLoadCollections();
  }, [project.id, derivedAppId, presenter.projectSettings, actions]);

  const isBusy =
    isLoadingCollections ||
    isLoadingCollection ||
    isSavingPermission ||
    isSavingRules ||
    isDeletingRules ||
    isResettingPermission;

  const disableAll = slugMissing || isBusy;
  const disableDetail = disableAll || !selectedCollection;
  const mode = permissionMode as CloudDbPermissionMode;

  const selectedSummary = useMemo(
    () => collections.find((c) => c.collection === selectedCollection) ?? null,
    [collections, selectedCollection],
  );

  const selectedUpdatedAt = useMemo(() => {
    if (!selectedSummary) return null;
    const permissionTs = selectedSummary.permission.updatedAt ?? 0;
    const rulesTs = selectedSummary.rules.updatedAt ?? 0;
    const max = Math.max(permissionTs, rulesTs);
    return max > 0 ? max : null;
  }, [selectedSummary]);

  const goToGeneral = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', 'general');
      return next;
    });
  };

  const handleAddCollection = async () => {
    const trimmed = newCollectionDraft.trim();
    await presenter.projectSettings.cloudDbAddCollection(trimmed);
    if (isValidCollectionName(trimmed)) setNewCollectionDraft('');
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
                {t('project.cloudDbSettings.collectionSelectedLabel', 'Selected')}
              </div>
              <div className="text-sm font-mono text-slate-900 dark:text-white mt-1">
                {selectedCollection ?? t('project.cloudDbSettings.collectionNone', 'None')}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {t(
                  'project.cloudDbSettings.collectionNote',
                  'This is just the collection you want to configure. It does not mean the project is already using Cloud DB.',
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {isLoadingCollections && (
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {t('project.cloudDbSettings.loadingCollections', 'Loading collections…')}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            {t('project.cloudDbSettings.collectionsTitle', 'Collections')}
          </h3>
          <button
            type="button"
            className="px-3 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
            onClick={presenter.projectSettings.cloudDbLoadCollections}
            disabled={disableAll}
          >
            {t('project.cloudDbSettings.refresh', 'Refresh')}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
          <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-slate-100 dark:border-slate-800 p-6 space-y-4">
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {t('project.cloudDbSettings.addCollection', 'Add collection')}
              </div>
              <div className="flex gap-2">
                <input
                  value={newCollectionDraft}
                  onChange={(e) => setNewCollectionDraft(e.target.value)}
                  disabled={disableAll}
                  className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  placeholder={t('project.cloudDbSettings.collectionPlaceholder', 'e.g. my_collection')}
                />
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60"
                  onClick={handleAddCollection}
                  disabled={disableAll || newCollectionDraft.trim().length === 0}
                >
                  {t('project.cloudDbSettings.add', 'Add')}
                </button>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {t('project.cloudDbSettings.collectionHint', 'Must be lowercase letters/numbers with - / _.')}
              </div>
            </div>

            <div className="space-y-2">
              {collections.length === 0 && !isLoadingCollections ? (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {t('project.cloudDbSettings.collectionsEmpty', 'No collections configured yet.')}
                </div>
              ) : (
                <div className="space-y-2">
                  {collections.map((c) => {
                    const isSelected = c.collection === selectedCollection;
                    const updatedAt = Math.max(c.permission.updatedAt ?? 0, c.rules.updatedAt ?? 0);
                    const updatedText = updatedAt
                      ? new Date(updatedAt).toLocaleString()
                      : t('project.notConfigured', 'Not configured');

                    return (
                      <button
                        key={c.collection}
                        type="button"
                        className={[
                          'w-full text-left rounded-xl border px-3 py-2 transition',
                          isSelected
                            ? 'border-brand-300 dark:border-brand-700 bg-brand-50/70 dark:bg-brand-950/30'
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800',
                        ].join(' ')}
                        onClick={() => presenter.projectSettings.cloudDbSelectCollection(c.collection)}
                        disabled={disableAll}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-mono text-slate-900 dark:text-white truncate">
                            {c.collection}
                          </div>
                          <div className="flex items-center gap-1">
                            {c.rules.hasRules && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-200">
                                {t('project.cloudDbSettings.rulesBadge', 'Rules')}
                              </span>
                            )}
                            {c.permission.isOverridden && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                                {t('project.cloudDbSettings.permissionBadge', 'Permission')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {t('project.cloudDbSettings.updatedLabel', 'Updated')}: {updatedText}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-8 p-6 space-y-6">
            {!selectedCollection ? (
              <div className="space-y-2">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  {t('project.cloudDbSettings.selectCollectionTitle', 'Select a collection')}
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {t(
                    'project.cloudDbSettings.selectCollectionHint',
                    'Choose a collection from the left to configure permission and Security Rules.',
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {t('project.cloudDbSettings.collectionLabel', 'Collection')}
                    </div>
                    <div className="text-lg font-mono text-slate-900 dark:text-white">{selectedCollection}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {t('project.cloudDbSettings.updatedLabel', 'Updated')}:{' '}
                      {selectedUpdatedAt ? new Date(selectedUpdatedAt).toLocaleString() : t('project.notConfigured', 'Not configured')}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="px-3 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
                    onClick={presenter.projectSettings.cloudDbLoadSelectedCollection}
                    disabled={disableAll}
                  >
                    {t('project.cloudDbSettings.reloadCollection', 'Reload')}
                  </button>
                </div>

                {isLoadingCollection && (
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {t('project.cloudDbSettings.loadingCollection', 'Loading collection…')}
                  </div>
                )}

                <div className="bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-slate-100 dark:border-slate-800">
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
                  <div className="p-5 space-y-3">
                    {hasRules && (
                      <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-200">
                        {t(
                          'project.cloudDbSettings.legacyIgnoredHint',
                          'Security Rules are enabled for this collection; legacy permission is ignored.',
                        )}
                      </div>
                    )}
                    {!permissionIsOverridden && (
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-950/40 p-3 text-sm text-slate-700 dark:text-slate-200">
                        {t(
                          'project.cloudDbSettings.permissionDefaultHint',
                          'Using default permission (only creator can read/write).',
                        )}
                      </div>
                    )}
                    <div className="flex flex-col md:flex-row md:items-center gap-3">
                      <select
                        value={mode}
                        onChange={(e) => presenter.projectSettings.cloudDbSetPermissionMode(e.target.value as CloudDbPermissionMode)}
                        disabled={disableDetail}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                      >
                        <option value="creator_read_write">
                          {t('project.cloudDbSettings.permissionModes.creator_read_write', 'Only creator can read/write (default)')}
                        </option>
                        <option value="all_read_creator_write">
                          {t(
                            'project.cloudDbSettings.permissionModes.all_read_creator_write',
                            'All users can read, only creator can write',
                          )}
                        </option>
                        <option value="all_read_readonly">
                          {t(
                            'project.cloudDbSettings.permissionModes.all_read_readonly',
                            'All users can read, nobody can write',
                          )}
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
                          disabled={disableDetail}
                        >
                          {t('common.save', 'Save')}
                        </button>
                        <button
                          type="button"
                          className="px-3 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
                          onClick={presenter.projectSettings.cloudDbResetPermission}
                          disabled={disableDetail}
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

                <div className="bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-slate-100 dark:border-slate-800">
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

                  <div className="p-5 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="px-3 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
                        onClick={() => presenter.projectSettings.cloudDbApplyRulesTemplate('public_feed_or_owner')}
                        disabled={disableDetail}
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
                        disabled={disableDetail}
                        title={t('project.cloudDbSettings.templateOwnerOnlyHelp', 'Owner-only read/write')}
                      >
                        {t('project.cloudDbSettings.templateOwnerOnly', 'Template: Owner only')}
                      </button>
                      <button
                        type="button"
                        className="px-3 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
                        onClick={presenter.projectSettings.cloudDbFormatRulesDraft}
                        disabled={disableDetail || rulesDraft.trim().length === 0}
                      >
                        {t('project.cloudDbSettings.formatJson', 'Format JSON')}
                      </button>
                    </div>

                    <textarea
                      value={rulesDraft}
                      onChange={(e) => presenter.projectSettings.cloudDbSetRulesDraft(e.target.value)}
                      disabled={disableDetail}
                      className="w-full min-h-[220px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
                      placeholder='{"version":0,"read":{"allOf":[{"field":"_openid","op":"==","value":{"var":"auth.openid"}}]},"write":{"allOf":[{"field":"_openid","op":"==","value":{"var":"auth.openid"}}]}}'
                    />

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="px-3 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60"
                        onClick={presenter.projectSettings.cloudDbSaveRules}
                        disabled={disableDetail || rulesDraft.trim().length === 0}
                      >
                        {t('project.cloudDbSettings.saveRules', 'Save rules')}
                      </button>
                      <button
                        type="button"
                        className="px-3 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
                        onClick={presenter.projectSettings.cloudDbDeleteRules}
                        disabled={disableDetail || !hasRules}
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
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

