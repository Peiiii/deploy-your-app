import { Loader2, LockKeyhole, Send, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePresenter } from '@/contexts/presenter-context';
import { useCommunityStore } from '@/features/community/stores/community.store';
import type { FeedbackCategory } from '@/types';

const CATEGORY_OPTIONS: FeedbackCategory[] = ['idea', 'bug', 'question'];

export const FeedbackComposer: React.FC = () => {
  const { t } = useTranslation();
  const presenter = usePresenter();
  const title = useCommunityStore((state) => state.composerTitle);
  const content = useCommunityStore((state) => state.composerContent);
  const category = useCommunityStore((state) => state.composerCategory);
  const isSubmitting = useCommunityStore((state) => state.isSubmitting);
  const actions = useCommunityStore((state) => state.actions);

  return (
    <section className="overflow-hidden rounded-3xl border border-brand-200 bg-white shadow-xl shadow-brand-500/5 dark:border-brand-500/20 dark:bg-slate-900">
      <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800 md:px-7">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {t('community.composer.title')}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t('community.composer.description')}
          </p>
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 dark:text-brand-300">
            <LockKeyhole className="h-3.5 w-3.5" />
            {t('community.composer.privacy')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => actions.setComposerOpen(false)}
          className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
          aria-label={t('common.close')}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-5 p-5 md:p-7">
        <div>
          <label
            className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200"
            htmlFor="feedback-title"
          >
            {t('community.composer.titleLabel')}
          </label>
          <input
            id="feedback-title"
            value={title}
            maxLength={120}
            onChange={(event) => actions.setComposerTitle(event.target.value)}
            placeholder={t('community.composer.titlePlaceholder')}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-800/70 dark:text-white dark:focus:bg-slate-800"
          />
          <div className="mt-1 text-right text-xs text-slate-400">{title.length}/120</div>
        </div>

        <div>
          <label
            className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200"
            htmlFor="feedback-content"
          >
            {t('community.composer.contentLabel')}
          </label>
          <textarea
            id="feedback-content"
            value={content}
            maxLength={3000}
            rows={5}
            onChange={(event) => actions.setComposerContent(event.target.value)}
            placeholder={t('community.composer.contentPlaceholder')}
            className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-800/70 dark:text-white dark:focus:bg-slate-800"
          />
          <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
            <span>{t('community.composer.contentHint')}</span>
            <span>{content.length}/3000</span>
          </div>
        </div>

        <div>
          <label
            className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200"
            htmlFor="feedback-category"
          >
            {t('community.composer.categoryLabel')}
          </label>
          <select
            id="feedback-category"
            value={category ?? ''}
            onChange={(event) =>
              actions.setComposerCategory(
                event.target.value ? (event.target.value as FeedbackCategory) : null
              )
            }
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200 dark:focus:bg-slate-800"
          >
            <option value="">{t('community.composer.categoryNone')}</option>
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {t(`community.categories.${option}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => actions.setComposerOpen(false)}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={isSubmitting || !title.trim() || !content.trim()}
            onClick={() => void presenter.community.submitPost()}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/20 transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {isSubmitting ? t('community.composer.publishing') : t('community.composer.publish')}
          </button>
        </div>
      </div>
    </section>
  );
};
