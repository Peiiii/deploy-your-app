import React from 'react';
import { Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ProjectSettingsThumbnailSectionProps {
  projectName: string;
  thumbnailUrl: string | null;
  thumbnailVersion: number;
  isUploadingThumbnail: boolean;
  onThumbnailFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onThumbnailPaste: (e: React.ClipboardEvent<HTMLDivElement>) => void;
}

export const ProjectSettingsThumbnailSection: React.FC<
  ProjectSettingsThumbnailSectionProps
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
    <div
      className="space-y-3"
      onPaste={onThumbnailPaste}
    >
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
        {t('project.thumbnail')}
      </h3>
      <p className="text-[11px] text-slate-500 dark:text-gray-400">
        {t('project.thumbnailDescription')}
      </p>
      <div className="flex items-center gap-4">
        <div className="relative w-40 h-24 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-950 overflow-hidden flex items-center justify-center">
          {thumbnailUrl ? (
            <img
              src={
                thumbnailVersion
                  ? `${thumbnailUrl}?v=${thumbnailVersion}`
                  : thumbnailUrl
              }
              alt={projectName}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              {t('common.notAccessible')}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2 text-[11px] text-slate-500 dark:text-gray-400">
          <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 hover:border-brand-500 hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer transition-colors">
            <Upload className="w-3 h-3" />
            <span>
              {isUploadingThumbnail
                ? t('project.thumbnailUploading')
                : t('project.thumbnailUpload')}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onThumbnailFileChange}
            />
          </label>
          <p>{t('project.thumbnailPasteHint')}</p>
        </div>
      </div>
    </div>
  );
};

