import React from 'react';
import { Heart, HeartOff, Save, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePresenter } from '@/contexts/presenter-context';
import { useProjectSettingsStore } from '@/features/project-settings/stores/project-settings.store';
import { useReactionStore } from '@/stores/reaction.store';
import type { Project } from '@/types';

interface ProjectSettingsMetadataSectionProps {
  project: Project;
}

export const ProjectSettingsMetadataSection: React.FC<
  ProjectSettingsMetadataSectionProps
> = ({ project }) => {
  const { t } = useTranslation();
  const presenter = usePresenter();

  // Subscribe to each state item individually
  const nameDraft = useProjectSettingsStore((s) => s.nameDraft);
  const slugDraft = useProjectSettingsStore((s) => s.slugDraft);
  const descriptionDraft = useProjectSettingsStore((s) => s.descriptionDraft);
  const categoryDraft = useProjectSettingsStore((s) => s.categoryDraft);
  const tagsDraft = useProjectSettingsStore((s) => s.tagsDraft);
  const isSavingMetadata = useProjectSettingsStore((s) => s.isSavingMetadata);
  const actions = useProjectSettingsStore((s) => s.actions);

  // Reactions from reaction store
  const reactionEntry = useReactionStore((s) => s.byProjectId[project.id]);
  const likesCount = reactionEntry?.likesCount ?? 0;
  const favoritesCount = reactionEntry?.favoritesCount ?? 0;
  const likedByCurrentUser = reactionEntry?.likedByCurrentUser ?? false;
  const favoritedByCurrentUser = reactionEntry?.favoritedByCurrentUser ?? false;

  // Compute slug editability
  const slugIsEditable = presenter.projectSettings.isSlugEditable(project);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
        {t('project.metadata')}
      </h3>
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
          {t('project.displayName')}
        </label>
        <input
          type="text"
          value={nameDraft}
          onChange={(e) => actions.setNameDraft(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all"
          placeholder={t('project.displayNamePlaceholder')}
        />
      </div>
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
          {t('project.slug')}
        </label>
        <input
          type="text"
          value={slugDraft}
          onChange={(e) => actions.setSlugDraft(e.target.value)}
          disabled={!slugIsEditable}
          className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          placeholder={t('project.slugPlaceholder')}
        />
        <p className="text-[11px] text-slate-500 dark:text-gray-400">
          {slugIsEditable ? t('project.slugHintEditable') : t('project.slugHintLocked')}
        </p>
      </div>
      <div className="flex items-center justify-between pt-1">
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-700 dark:text-gray-200">
            {t('project.likeAndFavorite')}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-gray-400">
            {t('project.likeAndFavoriteDescription')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={presenter.projectSettings.toggleLike}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] text-slate-700 dark:text-slate-200 hover:border-pink-500 hover:text-pink-600 dark:hover:text-pink-400"
          >
            {likedByCurrentUser ? (
              <Heart className="w-3 h-3 fill-pink-500 text-pink-500" />
            ) : (
              <HeartOff className="w-3 h-3" />
            )}
            <span>{likesCount}</span>
          </button>
          <button
            type="button"
            onClick={presenter.projectSettings.toggleFavorite}
            className={`inline-flex items-center justify-center w-7 h-7 rounded-full border text-[11px] ${
              favoritedByCurrentUser
                ? 'bg-yellow-400/90 border-yellow-500 text-yellow-900'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300'
            }`}
            aria-label={t('project.toggleFavorite')}
          >
            <Star
              className={`w-3 h-3 ${
                favoritedByCurrentUser ? 'fill-current' : ''
              }`}
            />
          </button>
        </div>
      </div>
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
          {t('project.description')}
        </label>
        <textarea
          value={descriptionDraft}
          onChange={(e) => actions.setDescriptionDraft(e.target.value)}
          rows={3}
          className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 resize-none transition-all"
          placeholder={t('project.descriptionPlaceholder')}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
            {t('project.category')}
          </label>
          <input
            type="text"
            value={categoryDraft}
            onChange={(e) => actions.setCategoryDraft(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all"
            placeholder={t('project.categoryPlaceholder')}
          />
        </div>
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
            {t('project.tags')}
          </label>
          <input
            type="text"
            value={tagsDraft}
            onChange={(e) => actions.setTagsDraft(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all"
            placeholder={t('project.tagsPlaceholder')}
          />
        </div>
      </div>
      <div className="flex items-center justify-between pt-2">
        <div className="text-xs text-slate-500 dark:text-gray-400">
          {isSavingMetadata && (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 border-2 border-slate-300 dark:border-slate-600 border-t-brand-500 rounded-full animate-spin"></span>
              {t('common.saving')}...
            </span>
          )}
        </div>
        <button
          onClick={presenter.projectSettings.saveMetadata}
          disabled={isSavingMetadata}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-brand-500 text-white hover:bg-brand-600 dark:bg-brand-500 dark:hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm hover:shadow"
        >
          <Save className={`w-3 h-3 ${isSavingMetadata ? 'animate-pulse' : ''}`} />
          {isSavingMetadata ? t('common.saving') : t('project.saveMetadata')}
        </button>
      </div>
    </div>
  );
};
