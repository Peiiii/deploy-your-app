import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useStore } from 'zustand';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowUpRight, Play, Star, ThumbsUp } from 'lucide-react';
import { usePresenter } from '@/contexts/presenter-context';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { useReactionStore } from '@/stores/reaction.store';
import { useUIStore } from '@/stores/ui.store';
import { getCategoryLabelKey } from '@/constants/app-categories';
import { getAuthorName, getAuthorInitial, getAuthorColor } from '@/utils/author';
import { getProjectDescription, getProjectThumbnailUrl } from '@/utils/project';
import { useProjectThumbnail } from '@/hooks/use-project-thumbnail';
import { AppPreviewContent } from '@/features/home/components/app-preview-content';
import { PreviewCommentsPanel } from '@/features/home/components/preview-comments-panel';
import { AppDetailManager } from '../managers/app-detail.manager';
import { AppShareLink } from '../components/app-share-link';
import type { PublicApp } from '@/types';

export function AppDetail() {
  const { id = '' } = useParams();
  return <AppDetailLoader key={id} id={id} />;
}

function AppDetailLoader({ id }: { id: string }) {
  const { t } = useTranslation();
  const [manager] = useState(() => new AppDetailManager(id));
  const state = useStore(manager.store);
  useEffect(() => {
    useUIStore.getState().actions.closeRightPanel();
    void manager.load();
    return manager.cancel;
  }, [manager]);
  if (state.loading) return <div role="status" className="p-12 text-center text-slate-500">{t('common.loading')}</div>;
  if (!state.app) return <div className="mx-auto max-w-xl space-y-5 px-6 py-16 text-center">
    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t(state.error === 'not-found' ? 'appDetail.unavailable' : 'appDetail.loadError')}</h1>
    <p className="text-sm text-slate-500">{t(state.error === 'not-found' ? 'appDetail.unavailableHint' : 'appDetail.retryHint')}</p>
    {state.error === 'network' && <button type="button" onClick={() => void manager.load()} className="rounded-xl bg-brand-600 px-5 py-2.5 text-white">{t('common.retry')}</button>}
    <Link to="/explore" className="block text-sm text-brand-600">{t('explore.exploreApps')}</Link>
  </div>;
  return <AppDetailContent app={state.app} />;
}

function AppDetailContent({ app }: { app: PublicApp }) {
  const { t, i18n } = useTranslation();
  const presenter = usePresenter();
  const userId = useAuthStore(s => s.user?.id);
  const reaction = useReactionStore(s => s.byProjectId[app.id]);
  const [playing, setPlaying] = useState(false);
  const [pending, setPending] = useState(false);
  const thumbnail = useProjectThumbnail(getProjectThumbnailUrl(app.url || '', { name: app.name, seed: app.id }) ?? undefined, true);
  const author = getAuthorName(app.publicAuthor, t);
  const description = getProjectDescription(app, i18n.resolvedLanguage || i18n.language);
  const isOwner = !!userId && userId === app.ownerId;
  useEffect(() => { void presenter.reaction.loadReactionsForProject(app.id); }, [app.id, userId, presenter.reaction]);
  const toggleReaction = async (kind: 'like' | 'favorite') => {
    if (!presenter.auth.getCurrentUser()) { presenter.auth.openAuthModal('login'); return; }
    if (pending || reaction?.isLoading) return;
    setPending(true);
    const success = await (kind === 'like' ? presenter.reaction.toggleLike(app.id) : presenter.reaction.toggleFavorite(app.id));
    if (!success) presenter.ui.showErrorToast(t('appDetail.reactionError'));
    setPending(false);
  };
  const authorBadge = <><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr ${getAuthorColor(app.publicAuthor.identityKey)} text-sm font-bold text-white`}>{getAuthorInitial(author, app.publicAuthor.anonymousCode)}</span><span className="truncate text-sm font-medium">{author}</span></>;
  return <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link to="/explore" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-brand-600"><ArrowLeft className="h-4 w-4" />{t('explore.exploreApps')}</Link>
      {isOwner && <Link to={`/projects/${encodeURIComponent(app.id)}?tab=feedback`} className="text-sm font-medium text-brand-600">{t('appDetail.manageFeedback')} →</Link>}
    </div>
    <header className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
        <div className="min-w-0 flex-1 space-y-3">
          <span className="inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 dark:bg-brand-950 dark:text-brand-300">{t(getCategoryLabelKey(app.category || 'Other'))}</span>
          <h1 className="break-words text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">{app.name}</h1>
        </div>
        <AppShareLink id={app.id} />
      </div>
      {description && <p className="max-w-3xl whitespace-pre-wrap break-words text-base leading-relaxed text-slate-600 dark:text-slate-300">{description}</p>}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4 dark:border-slate-800">
        {app.publicAuthor.profileIdentifier ? <Link to={`/u/${encodeURIComponent(app.publicAuthor.profileIdentifier)}`} className="inline-flex min-w-0 max-w-full items-center gap-3 text-slate-700 hover:text-brand-600 dark:text-slate-300">{authorBadge}<ArrowUpRight className="h-4 w-4 shrink-0" /></Link> : <div className="flex min-w-0 items-center gap-3 text-slate-700 dark:text-slate-300">{authorBadge}</div>}
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={reaction?.likedByCurrentUser ?? false} disabled={pending || reaction?.isLoading} onClick={() => void toggleReaction('like')} className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-sm text-slate-600 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300"><ThumbsUp className={`h-4 w-4 ${reaction?.likedByCurrentUser ? 'fill-brand-500 text-brand-500' : ''}`} />{t('previewActions.like')} <span>{reaction?.likesCount ?? 0}</span></button>
          <button type="button" aria-pressed={reaction?.favoritedByCurrentUser ?? false} disabled={pending || reaction?.isLoading} onClick={() => void toggleReaction('favorite')} className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-sm text-slate-600 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300"><Star className={`h-4 w-4 ${reaction?.favoritedByCurrentUser ? 'fill-amber-400 text-amber-500' : ''}`} />{t('previewActions.favorite')}</button>
        </div>
      </div>
    </header>
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" aria-label={t('appDetail.experience')}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800"><h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t('appDetail.experience')}</h2><a href={app.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-brand-600">{t('common.openInNewTab')}<ArrowUpRight className="h-3.5 w-3.5" /></a></div>
        <div className="relative h-[480px] bg-gradient-to-br from-brand-100 to-indigo-100 dark:from-brand-950 dark:to-slate-800 sm:h-[560px]">
          {playing ? <AppPreviewContent name={app.name} url={app.url!} onOpenInNewTab={url => window.open(url, '_blank', 'noopener,noreferrer')} /> : <>
            {!thumbnail.error && <img src={thumbnail.src} onLoad={thumbnail.onLoad} onError={thumbnail.onError} alt="" className={`absolute inset-0 h-full w-full object-cover ${thumbnail.loaded ? 'opacity-100' : 'opacity-0'}`} />}
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/20"><button type="button" onClick={() => setPlaying(true)} className="inline-flex items-center gap-3 rounded-2xl bg-white px-7 py-4 text-base font-semibold text-brand-700 shadow-xl transition-transform hover:scale-105"><Play className="h-5 w-5 fill-current" />{t('appDetail.start')}</button></div>
          </>}
        </div>
      </section>
      <div className="h-[560px] min-w-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 xl:h-[610px]"><PreviewCommentsPanel key={app.id} projectId={app.id} panelId="app-feedback" appName={app.name} open isFullscreen={false} /></div>
    </div>
    <aside className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-brand-50 p-5 dark:bg-brand-950/40"><div><p className="font-semibold text-slate-800 dark:text-slate-200">{t('appDetail.createTitle')}</p><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('appDetail.createHint')}</p></div><Link to="/deploy" className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white">{t('appDetail.create')}<ArrowUpRight className="h-4 w-4" /></Link></aside>
  </div>;
}
