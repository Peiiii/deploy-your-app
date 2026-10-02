import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FileCode, Upload } from 'lucide-react';

const COMPACT_TOOL_BUTTON_CLASS = 'inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white';

interface HtmlSourceFormProps {
  htmlContent: string;
  onHtmlChange: (value: string) => void;
  onHtmlBlur: () => void;
  onInsertTemplate: () => void;
  onHtmlFileSelected: (file: File) => Promise<void> | void;
  showError: boolean;
  compact?: boolean;
}

export const HtmlSourceForm: React.FC<HtmlSourceFormProps> = ({
  htmlContent,
  onHtmlChange,
  onHtmlBlur,
  onInsertTemplate,
  onHtmlFileSelected,
  showError,
  compact = false,
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
    <div className={compact ? 'overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900' : 'space-y-4'}>
      <label htmlFor="publication-html" className={compact ? 'sr-only' : 'block text-sm font-medium text-slate-900 dark:text-white'}>
        HTML {t('common.content') || 'Content'}
      </label>
      <textarea
        id="publication-html"
        value={htmlContent}
        onChange={(e) => onHtmlChange(e.target.value)}
        onBlur={onHtmlBlur}
        rows={compact ? 8 : 10}
        className={compact
          ? 'block min-h-52 w-full resize-y bg-transparent px-4 py-3.5 font-mono text-sm leading-relaxed text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500/50 dark:text-white dark:placeholder-slate-500'
          : 'block w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent transition-all font-mono text-sm'}
        placeholder={t(compact ? 'deployment.htmlPlaceholder' : 'deployment.pasteHTMLDescription')}
      />
      <div className={compact ? 'flex flex-wrap gap-1 border-t border-slate-200/70 px-2 py-1.5 dark:border-slate-700' : 'flex flex-wrap gap-2'}>
        <button
          type="button"
          onClick={onInsertTemplate}
          className={compact
            ? COMPACT_TOOL_BUTTON_CLASS
            : 'inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-purple-600 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 rounded-full hover:bg-purple-100 dark:hover:bg-purple-900/50'}
        >
          <FileCode className="w-3 h-3" />
          {t(compact ? 'deployment.trySample' : 'deployment.insertSampleTemplate')}
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={compact
            ? COMPACT_TOOL_BUTTON_CLASS
            : 'inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700'}
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
