import React from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';

interface ProjectSettingsPublicUrlSectionProps {
  projectUrl: string | null | undefined;
}

export const ProjectSettingsPublicUrlSection: React.FC<
  ProjectSettingsPublicUrlSectionProps
> = ({ projectUrl }) => {
  const { t } = useTranslation();
  const { copied, copyToClipboard } = useCopyToClipboard();

  const handleCopyUrl = () => {
    if (projectUrl) {
      copyToClipboard(projectUrl);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
        {t('project.publicUrl')}
      </h3>
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950/40 dark:to-slate-900/40 p-4">
        <div className="flex items-center justify-between gap-3">
          {projectUrl ? (
            <>
              <a
                href={projectUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-green-600 dark:text-green-400 hover:text-green-500 dark:hover:text-green-300 break-all transition-colors flex-1 min-w-0"
              >
                <span className="truncate">{projectUrl}</span>
                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
              </a>
              <button
                onClick={handleCopyUrl}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors flex-shrink-0"
                title={t('common.copyUrl')}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>{t('common.copied')}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>{t('common.copyUrl')}</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <p className="text-sm text-slate-400 dark:text-gray-500">
              {t('common.notAccessible')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
