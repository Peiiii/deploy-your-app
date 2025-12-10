import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FileCode, Upload, X } from 'lucide-react';

interface ZipSourceFormProps {
  zipFile: File | null;
  onFileSelected: (file: File) => void;
  onClearFile: () => void;
}

export const ZipSourceForm: React.FC<ZipSourceFormProps> = ({
  zipFile,
  onFileSelected,
  onClearFile,
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelected(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onFileSelected(file);
    }
  };

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-slate-900 dark:text-white">
        {t('deployment.uploadArchive')}
      </label>
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer group ${
          zipFile
            ? 'border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950/20'
            : 'border-slate-300 dark:border-slate-700 hover:border-purple-400 dark:hover:border-purple-700 bg-slate-50 dark:bg-slate-800/50'
        }`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".zip"
          onChange={handleFileChange}
        />
        {zipFile ? (
          <div className="space-y-3">
            <div className="w-12 h-12 mx-auto bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center">
              <FileCode className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {zipFile.name}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {(zipFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClearFile();
              }}
              className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium inline-flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              {t('common.delete')}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="w-12 h-12 mx-auto bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center group-hover:bg-purple-100 dark:group-hover:bg-purple-900/40 transition-colors">
              <Upload className="w-6 h-6 text-slate-600 dark:text-slate-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {t('deployment.uploadZipDescription')}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {t('deployment.maximumFileSize')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

