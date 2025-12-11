import { AlertTriangle } from 'lucide-react';
import React from 'react';
import { ProjectSettingsHeader } from './project-settings/ProjectSettingsHeader';
import { ProjectSettingsRepoSection } from './project-settings/ProjectSettingsRepoSection';
import { ProjectSettingsMetadataSection } from './project-settings/ProjectSettingsMetadataSection';
import { ProjectSettingsThumbnailSection } from './project-settings/ProjectSettingsThumbnailSection';
import { ProjectSettingsRedeploySection } from './project-settings/ProjectSettingsRedeploySection';
import { ProjectSettingsSidebar } from './project-settings/ProjectSettingsSidebar';
import type { Project } from '../types';
import type {
  ProjectSettingsCardAnalyticsProps,
  ProjectSettingsCardReactionsProps,
} from './project-settings/types';

interface ProjectSettingsCardProps {
  project: Project;
  repoLabel: string;
  repoUrlDraft: string;
  onRepoUrlChange: (value: string) => void;
  onSaveRepoUrl: () => void;
  isSavingRepoUrl: boolean;
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
  canRedeployFromGitHub: boolean;
  isRedeploying: boolean;
  isDeploymentInProgress: boolean;
  onRedeployFromGitHub: () => void;
  zipUploading: boolean;
  onZipUpload: (file: File) => void;
  thumbnailUrl: string | null;
  thumbnailVersion: number;
  isUploadingThumbnail: boolean;
  onThumbnailFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onThumbnailPaste: (e: React.ClipboardEvent<HTMLDivElement>) => void;
  isPublic: boolean | undefined;
  onTogglePublicVisibility: () => void;
  analytics: ProjectSettingsCardAnalyticsProps;
  reactions: ProjectSettingsCardReactionsProps;
  onToggleLike: () => void;
  onToggleFavorite: () => void;
  error: string | null;
  onDeleteProject: () => void;
}

export const ProjectSettingsCard: React.FC<ProjectSettingsCardProps> = ({
  project,
  repoLabel,
  repoUrlDraft,
  onRepoUrlChange,
  onSaveRepoUrl,
  isSavingRepoUrl,
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
  canRedeployFromGitHub,
  isRedeploying,
  isDeploymentInProgress,
  onRedeployFromGitHub,
  zipUploading,
  onZipUpload,
  thumbnailUrl,
  thumbnailVersion,
  isUploadingThumbnail,
  onThumbnailFileChange,
  onThumbnailPaste,
  // isPublic,
  // onTogglePublicVisibility,
  analytics,
  reactions,
  onToggleLike,
  onToggleFavorite,
  error,
  onDeleteProject,
}) => {
  const handleZipInputChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (zipUploading || isDeploymentInProgress) {
      event.target.value = '';
      return;
    }
    await onZipUpload(file);
    event.target.value = '';
  };

  return (
    <div className="glass-card rounded-2xl p-6 md:p-8 flex flex-col gap-8">
      <ProjectSettingsHeader project={project} />

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        <div className="flex-1 space-y-6">
          <ProjectSettingsRepoSection
            project={project}
            repoLabel={repoLabel}
            repoUrlDraft={repoUrlDraft}
            onRepoUrlChange={onRepoUrlChange}
            onSaveRepoUrl={onSaveRepoUrl}
            isSavingRepoUrl={isSavingRepoUrl}
          />

          <ProjectSettingsMetadataSection
            nameDraft={nameDraft}
            onNameChange={onNameChange}
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

          <ProjectSettingsThumbnailSection
            projectName={project.name}
            thumbnailUrl={thumbnailUrl}
            thumbnailVersion={thumbnailVersion}
            isUploadingThumbnail={isUploadingThumbnail}
            onThumbnailFileChange={onThumbnailFileChange}
            onThumbnailPaste={onThumbnailPaste}
          />

          <ProjectSettingsRedeploySection
            canRedeployFromGitHub={canRedeployFromGitHub}
            isRedeploying={isRedeploying}
            isDeploymentInProgress={isDeploymentInProgress}
            onRedeployFromGitHub={onRedeployFromGitHub}
            zipUploading={zipUploading}
            onZipInputChange={handleZipInputChange}
          />
        </div>

        <ProjectSettingsSidebar
          project={project}
          analytics={analytics}
          onDeleteProject={onDeleteProject}
        />
      </div>

      {error && (
        <div className="flex items-start gap-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 shadow-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
        </div>
      )}
    </div>
  );
};
