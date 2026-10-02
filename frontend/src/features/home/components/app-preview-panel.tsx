import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Maximize2, Minimize2, X } from 'lucide-react';
import type { ExploreAppCard } from '@/components/explore-app-card';
import { useUIStore } from '@/stores/ui.store';

export const AppPreviewPanel = ({ app, onClose, onOpenInNewTab }: {
  app: ExploreAppCard;
  onClose: () => void;
  onOpenInNewTab: (url: string) => void;
}) => {
  const { t } = useTranslation();
  const fullscreen = useUIStore((s) => s.rightPanelLayout === 'fullscreen');
  const toggleFullscreen = useUIStore((s) => s.actions.toggleRightPanelLayout);
  const [loading, setLoading] = useState(true);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus({ preventScroll: true });
    return () => { if (trigger?.isConnected) trigger.focus({ preventScroll: true }); };
  }, []);
  return (
    <section className="flex h-full min-w-0 flex-col bg-app-bg" aria-label={app.name} onKeyDown={(event) => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
    }}>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-app-border px-4">
        <h2 className="min-w-0 flex-1 truncate text-sm font-medium">{app.name}</h2>
        {app.url && <button className="icon-button" onClick={() => onOpenInNewTab(app.url!)} title={t('common.openInNewTab')} aria-label={t('common.openInNewTab')}><ExternalLink className="h-[18px] w-[18px]" /></button>}
        <button className="icon-button" onClick={toggleFullscreen} title={t(fullscreen ? 'common.exitFullscreen' : 'common.fullscreen')} aria-label={t(fullscreen ? 'common.exitFullscreen' : 'common.fullscreen')}>{fullscreen ? <Minimize2 className="h-[18px] w-[18px]" /> : <Maximize2 className="h-[18px] w-[18px]" />}</button>
        <button ref={closeRef} className="icon-button" onClick={onClose} title={t('common.close')} aria-label={t('common.close')}><X className="h-5 w-5" /></button>
      </header>
      {loading && <div role="status" className="border-b border-app-border px-4 py-2 text-xs text-app-muted">{t('common.loading')}</div>}
      {app.url ? <iframe src={app.url} title={app.name} className="min-h-0 w-full flex-1 border-0 bg-white" onLoad={() => setLoading(false)} sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals" /> : <p className="p-6 text-app-muted">{t('common.notAccessible')}</p>}
    </section>
  );
};
