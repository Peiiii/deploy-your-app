import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShareLink } from '@/features/app-detail/components/app-share-link';
import { PreviewCommentsPanel } from '@/features/home/components/preview-comments-panel';
import type { Project } from '@/types';

export function SettingsFeedbackTab({ project }: { project: Project }) {
  const { t } = useTranslation();
  let canShare = project.status === 'Live' && project.isPublic !== false;
  try {
    const url = new URL(project.url || '');
    canShare = canShare && ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch { canShare = false; }
  return <div className="space-y-6">
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('appDetail.shareTitle')}</h2>
      <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">{t('appDetail.shareHint')}</p>
      {canShare ? <AppShareLink id={project.id} showOpen /> : <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">{t('appDetail.notShareable')}</p>}
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-brand-600"><Link to={`?tab=general`}>{t('appDetail.editIntro')}</Link><Link to={`?tab=analytics`}>{t('appDetail.viewAnalytics')}</Link></div>
    </section>
    <section className="space-y-3">
      <p className="text-sm text-slate-500 dark:text-slate-400">{t('appDetail.feedbackHint')}</p>
      <div className="h-[600px] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700"><PreviewCommentsPanel key={project.id} projectId={project.id} panelId="owner-feedback" appName={project.name} open isFullscreen={false} /></div>
    </section>
  </div>;
}
