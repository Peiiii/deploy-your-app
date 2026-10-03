import { Check, Copy, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { usePresenter } from '@/contexts/presenter-context';

const appPagePath = (id: string) => `/app/${encodeURIComponent(id)}`;

export function AppShareLink({ id, showOpen = false }: { id: string; showOpen?: boolean }) {
  const { t } = useTranslation();
  const presenter = usePresenter();
  const { copied, copyToClipboard } = useCopyToClipboard({
    onError: () => presenter.ui.showErrorToast(t('appDetail.copyError')),
  });
  return <div className="flex flex-wrap gap-2">
    <button type="button" onClick={() => void copyToClipboard(`${window.location.origin}${appPagePath(id)}`)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
      {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
      {t(copied ? 'common.copied' : 'appDetail.share')}
    </button>
    {showOpen && <Link to={appPagePath(id)} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white">
      <ExternalLink className="h-4 w-4" />{t('appDetail.view')}
    </Link>}
  </div>;
}
