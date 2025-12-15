import React, { useState, useRef } from 'react';
import { Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePresenter } from '@/contexts/presenter-context';
import { useProjectSettingsStore } from '@/features/project-settings/stores/project-settings-store';
import { getProjectThumbnailUrl } from '@/utils/project';
import type { Project } from '@/types';

interface ProjectSettingsThumbnailSectionProps {
  project: Project;
}

export const ProjectSettingsThumbnailSection: React.FC<
  ProjectSettingsThumbnailSectionProps
> = ({ project }) => {
  const { t } = useTranslation();
  const presenter = usePresenter();

  // Subscribe to store state individually
  const isUploadingThumbnail = useProjectSettingsStore((s) => s.isUploadingThumbnail);
  const thumbnailVersion = useProjectSettingsStore((s) => s.thumbnailVersion);

  // Derived state
  const thumbnailUrl = getProjectThumbnailUrl(project.url);

  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      const fakeInput = document.createElement('input');
      fakeInput.type = 'file';
      fakeInput.files = dataTransfer.files;
      const fakeEvent = {
        target: fakeInput,
        currentTarget: fakeInput,
      } as React.ChangeEvent<HTMLInputElement>;
      presenter.projectSettings.handleThumbnailFileChange(fakeEvent);
    }
  };

  return (
    <div
      ref={containerRef}
      className="space-y-3"
      onPaste={presenter.projectSettings.handleThumbnailPaste}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
        {t('project.thumbnail')}
      </h3>
      <p className="text-[11px] text-slate-500 dark:text-gray-400">
        {t('project.thumbnailDescription')}
      </p>
      <div className="flex items-center gap-4">
        <div
          className={`
            relative w-40 h-24 rounded-xl border border-dashed overflow-hidden flex items-center justify-center transition-colors cursor-pointer
            ${isDragging 
              ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/30' 
              : 'border-slate-300 dark:border-slate-700 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-950 hover:border-brand-400'
            }
          `}
          onClick={() => fileInputRef.current?.click()}
        >
          {thumbnailUrl ? (
            <>
              <img
                src={
                  thumbnailVersion
                    ? `${thumbnailUrl}?v=${thumbnailVersion}`
                    : thumbnailUrl
                }
                alt={project.name}
                className="w-full h-full object-cover"
              />
              {isUploadingThumbnail && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </>
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
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={presenter.projectSettings.handleThumbnailFileChange}
            />
          </label>
          <p className="flex items-center gap-1.5">
            <span>{t('project.thumbnailPasteHint')}</span>
            <kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-mono border border-slate-300 dark:border-slate-700">
              {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+V
            </kbd>
          </p>
        </div>
      </div>
    </div>
  );
};
