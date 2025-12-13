import React from 'react';
import { useTranslation } from 'react-i18next';
import { ProjectSettingsMetadataSection } from './ProjectSettingsMetadataSection';
import { ProjectSettingsRepoSection } from './ProjectSettingsRepoSection';
import type {
  ProjectSettingsCardReactionsProps,
  ProjectSettingsProject,
} from './types';

interface ProjectSettingsBasicInfoGroupProps {
  project: ProjectSettingsProject;
  repoLabel: string;
  repoUrlDraft: string;
  onRepoUrlChange: (value: string) => void;
  onSaveRepoUrl: () => void;
  isSavingRepoUrl: boolean;
  nameDraft: string;
  onNameChange: (value: string) => void;
  slugDraft: string;
  onSlugChange: (value: string) => void;
  slugIsEditable: boolean;
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

export const ProjectSettingsBasicInfoGroup: React.FC<
  ProjectSettingsBasicInfoGroupProps
> = ({
  project,
  repoLabel,
  repoUrlDraft,
  onRepoUrlChange,
  onSaveRepoUrl,
  isSavingRepoUrl,
  nameDraft,
  onNameChange,
  slugDraft,
  onSlugChange,
  slugIsEditable,
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
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
            {t('project.basicInfo')}
          </h2>
          <div className="space-y-6">
            <ProjectSettingsRepoSection
              project={project}
              repoLabel={repoLabel}
              repoUrlDraft={repoUrlDraft}
              onRepoUrlChange={onRepoUrlChange}
              onSaveRepoUrl={onSaveRepoUrl}
              isSavingRepoUrl={isSavingRepoUrl}
            />
            <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
              <ProjectSettingsMetadataSection
                nameDraft={nameDraft}
                onNameChange={onNameChange}
                slugDraft={slugDraft}
                onSlugChange={onSlugChange}
                slugIsEditable={slugIsEditable}
                descriptionDraft={descriptionDraft}
                onDescriptionChange={onDescriptionChange}
                categoryDraft={categoryDraft}
                onCategoryChange={onCategoryChange}
                tagsDraft={tagsDraft}
                onTagsChange={onTagsChange}
                isSavingMetadata={isSavingMetadata}
                onSaveMetadata={onSaveMetadata}
                reactions={reactions}
                onToggleLike={onToggleLike}
                onToggleFavorite={onToggleFavorite}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };
