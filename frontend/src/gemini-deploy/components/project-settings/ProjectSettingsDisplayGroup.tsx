import React from 'react';
import { useTranslation } from 'react-i18next';
import { ProjectSettingsThumbnailSection } from './ProjectSettingsThumbnailSection';

interface ProjectSettingsDisplayGroupProps {
  projectName: string;
  thumbnailUrl: string | null;
  thumbnailVersion: number;
  isUploadingThumbnail: boolean;
  onThumbnailFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onThumbnailPaste: (e: React.ClipboardEvent<HTMLDivElement>) => void;
}

export const ProjectSettingsDisplayGroup: React.FC<
  ProjectSettingsDisplayGroupProps
> = ({
  projectName,
  thumbnailUrl,
  thumbnailVersion,
  isUploadingThumbnail,
  onThumbnailFileChange,
  onThumbnailPaste,
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
          {t('project.displaySettings')}
        </h2>
        <ProjectSettingsThumbnailSection
          projectName={projectName}
          thumbnailUrl={thumbnailUrl}
          thumbnailVersion={thumbnailVersion}
          isUploadingThumbnail={isUploadingThumbnail}
          onThumbnailFileChange={onThumbnailFileChange}
          onThumbnailPaste={onThumbnailPaste}
        />
      </div>
    </div>
  );
};
