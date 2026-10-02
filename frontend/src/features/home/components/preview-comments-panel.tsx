import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/dialog';
import { usePresenter } from '@/contexts/presenter-context';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { PreviewCommentsManager } from '../managers/preview-comments.manager';

interface PreviewCommentsPanelProps {
  projectId: string;
  appName: string;
  onClose: () => void;
}

export const PreviewCommentsPanel = ({ projectId, appName, onClose }: PreviewCommentsPanelProps) => {
  const { t } = useTranslation();
  const presenter = usePresenter();
  const userId = useAuthStore(s => s.user?.id);
  const [manager] = useState(() => new PreviewCommentsManager(projectId, (force = false) => {
    if (!force && presenter.auth.getCurrentUser()) return true;
    presenter.auth.openAuthModal('login');
    return false;
  }));
  const state = useStore(manager.store);

  useEffect(() => {
    void manager.load();
    return manager.invalidate;
  }, [manager, userId]);

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent closeLabel={t('common.close')} onEscapeKeyDown={event => event.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{t('previewActions.comments')} · {state.total}</DialogTitle>
          <DialogDescription>{appName}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[45dvh] space-y-4 overflow-y-auto" aria-busy={state.loading}>
          {state.error && (
            <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30">
              {t('previewActions.commentError')}
              <button type="button" disabled={state.loading || state.submitting || !!state.deletingId} onClick={() => manager.load()} className="ml-2 underline">{t('common.retry')}</button>
            </div>
          )}
          {!state.loading && !state.error && state.items.length === 0 && <p className="py-8 text-center text-sm text-slate-400">{t('previewActions.noComments')}</p>}
          {state.items.map(comment => (
            <article key={comment.id} className="border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                <span>{comment.author.handle ? `@${comment.author.handle}` : comment.author.displayName || t('previewActions.commentAuthor')}</span>
                <div className="flex gap-2">
                  <button type="button" disabled={state.submitting || !!state.deletingId} onClick={() => manager.reply(comment)}>{t('previewActions.reply')}</button>
                  {comment.canDelete && <button type="button" disabled={state.loading || state.submitting || !!state.deletingId} onClick={() => manager.remove(comment)} className="text-red-500">{t('common.delete')}</button>}
                </div>
              </div>
              {comment.replyTo && <p className="mt-1 text-xs text-slate-400">{t('previewActions.replyingTo', { name: comment.replyTo.handle || comment.replyTo.displayName || t('previewActions.commentAuthor') })}</p>}
              <p className="mt-2 whitespace-pre-wrap break-words text-sm">{comment.content}</p>
              <time dateTime={comment.createdAt} className="mt-1 block text-[10px] text-slate-400">{new Date(comment.createdAt).toLocaleString()}</time>
            </article>
          ))}
          {state.loading && <p role="status" className="py-3 text-center text-sm text-slate-400">{t('common.loading')}</p>}
          {!state.loading && state.items.length < state.total && <button type="button" disabled={state.submitting || !!state.deletingId} onClick={() => manager.load(true)} className="w-full py-2 text-sm text-brand-600">{t('explore.loadMore')}</button>}
        </div>
        <form data-submit-event="comment_submit" onSubmit={event => { event.preventDefault(); void manager.submit(); }} className="mt-4 space-y-2 border-t border-slate-200 pt-4 dark:border-slate-700">
          {state.replyTo && <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
            <span>{t('previewActions.replyingTo', { name: state.replyTo.author.handle || state.replyTo.author.displayName || t('previewActions.commentAuthor') })}</span>
            <button type="button" onClick={() => manager.reply(null)}>{t('common.cancel')}</button>
          </div>}
          <textarea aria-label={t('explore.feed.addComment')} placeholder={t('explore.feed.addComment')} value={state.draft} onChange={event => manager.setDraft(event.target.value)} maxLength={500} rows={3} disabled={state.submitting} className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800" />
          <button type="submit" disabled={!state.draft.trim() || state.loading || state.submitting || !!state.deletingId} className="w-full rounded-xl bg-brand-600 py-2 text-sm font-medium text-white disabled:opacity-40">{state.submitting ? t('common.pleaseWait') : t('explore.feed.send')}</button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
