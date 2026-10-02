import { track } from '@/analytics/collector';
import { copyToClipboard } from '@/utils/clipboard';
import { Check, Copy, ExternalLink, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const skillUrl = 'https://gemigo.io/skills/gemigo-cli/SKILL.md';

export const AiPublishCard = () => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const handleCopy = async () => {
    try {
      await copyToClipboard(t('home.aiPublishPrompt', { skillUrl }));
      setCopied(true);
      setCopyFailed(false);
      track('quick_deploy_click', { dimension: 'ai_skill' });
    } catch {
      setCopyFailed(true);
    }
  };

  return (
    <section className="rounded-xl border border-brand-200 bg-brand-50/70 p-3 dark:border-brand-800 dark:bg-brand-950/30">
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300">
            <Sparkles aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {t('home.aiPublishTitle')}
            </h3>
            <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
              {t('home.aiPublishDescription')}
            </p>
            <a
              href={skillUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-700 underline-offset-2 hover:underline dark:text-brand-300"
            >
              {t('home.aiPublishViewSkill')}
              <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
        <div className="w-full">
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            {copied ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
            {t(copied ? 'home.aiPublishCopied' : 'home.aiPublishCopy')}
          </button>
          {copyFailed && (
            <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">
              {t('home.aiPublishCopyFailed')}
            </p>
          )}
        </div>
      </div>
    </section>
  );
};
