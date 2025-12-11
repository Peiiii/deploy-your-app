import React from 'react';
import { Heart, HeartOff, Save, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ProjectSettingsCardReactionsProps } from './types';

interface ProjectSettingsMetadataSectionProps {
  nameDraft: string;
  onNameChange: (value: string) => void;
  descriptionDraft: string;
  onDescriptionChange: (value: string) => void;
  categoryDraft: string;
  onCategoryChange: (value: string) => void;
  tagsDraft: string;
  onTagsChange: (value: string) => void;
  isSavingMetadata: boolean;
  onSaveMetadata: () => void;
  reactions: ProjectSettingsCardReactionsProps;
  onToggleLike: () => void;
  onToggleFavorite: () => void;
}

export const ProjectSettingsMetadataSection: React.FC<
  ProjectSettingsMetadataSectionProps
> = ({
  nameDraft,
  onNameChange,
  descriptionDraft,
  onDescriptionChange,
  categoryDraft,
  onCategoryChange,
  tagsDraft,
  onTagsChange,
  isSavingMetadata,
  onSaveMetadata,
  reactions,
  onToggleLike,
  onToggleFavorite,
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
        {t('project.metadata')}
      </h3>
      <div className="space-y-2">
        <label className="block text-xs font-medium text-slate-500 dark:text-gray-400">
          {t('project.displayName')}
        </label>
        <input
          type="text"
          value={nameDraft}
          onChange={(e) => onNameChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          placeholder={t('project.displayNamePlaceholder')}
        />
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
            onClick={onToggleLike}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] text-slate-700 dark:text-slate-200 hover:border-pink-500 hover:text-pink-600 dark:hover:text-pink-400"
          >
            {reactions.likedByCurrentUser ? (
              <Heart className="w-3 h-3 fill-pink-500 text-pink-500" />
            ) : (
              <HeartOff className="w-3 h-3" />
            )}
            <span>{reactions.likesCount}</span>
          </button>
          <button
            type="button"
            onClick={onToggleFavorite}
            className={`inline-flex items-center justify-center w-7 h-7 rounded-full border text-[11px] ${
              reactions.favoritedByCurrentUser
                ? 'bg-yellow-400/90 border-yellow-500 text-yellow-900'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300'
            }`}
            aria-label={t('project.toggleFavorite')}
          >
            <Star
              className={`w-3 h-3 ${
                reactions.favoritedByCurrentUser ? 'fill-current' : ''
              }`}
            />
          </button>
        </div>
      </div>
      <div className="space-y-2">
        <label className="block text-xs font-medium text-slate-500 dark:text-gray-400">
          {t('project.description')}
        </label>
        <textarea
          value={descriptionDraft}
          onChange={(e) => onDescriptionChange(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
          placeholder={t('project.descriptionPlaceholder')}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="block text-xs font-medium text-slate-500 dark:text-gray-400">
            {t('project.category')}
          </label>
          <input
            type="text"
            value={categoryDraft}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            placeholder={t('project.categoryPlaceholder')}
          />
        </div>
        <div className="space-y-2">
          <label className="block text-xs font-medium text-slate-500 dark:text-gray-400">
            {t('project.tags')}
          </label>
          <input
            type="text"
            value={tagsDraft}
            onChange={(e) => onTagsChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            placeholder={t('project.tagsPlaceholder')}
          />
        </div>
      </div>
      <div className="flex justify-end">
        <button
          onClick={onSaveMetadata}
          disabled={isSavingMetadata}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50"
        >
          <Save className="w-3 h-3" />
          {t('project.saveMetadata')}
        </button>
      </div>
    </div>
  );
};

