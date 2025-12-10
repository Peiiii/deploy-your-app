import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FileCode, Upload } from 'lucide-react';

interface HtmlSourceFormProps {
  htmlContent: string;
  onHtmlChange: (value: string) => void;
  onHtmlBlur: () => void;
  onInsertTemplate: () => void;
  onHtmlFileSelected: (file: File) => Promise<void> | void;
  showError: boolean;
}

export const HtmlSourceForm: React.FC<HtmlSourceFormProps> = ({
  htmlContent,
  onHtmlChange,
  onHtmlBlur,
  onInsertTemplate,
  onHtmlFileSelected,
  showError,
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = e.target.files?.[0];
    if (file) {
      await onHtmlFileSelected(file);
    }
  };

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-slate-900 dark:text-white">
        HTML {t('common.content') || 'Content'}
      </label>
      <textarea
        value={htmlContent}
        onChange={(e) => onHtmlChange(e.target.value)}
        onBlur={onHtmlBlur}
        rows={10}
        className="block w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent transition-all font-mono text-sm"
        placeholder={t('deployment.pasteHTMLDescription')}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onInsertTemplate}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-purple-600 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 rounded-full hover:bg-purple-100 dark:hover:bg-purple-900/50"
        >
          <FileCode className="w-3 h-3" />
          {t('deployment.insertSampleTemplate')}
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"
        >
          <Upload className="w-3 h-3" />
          {t('deployment.importHtmlFile')}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".html,text/html"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
      {showError && (
        <p className="text-xs text-red-500">
          {t('deployment.pasteHTMLDescription')}
        </p>
      )}
    </div>
  );
};

