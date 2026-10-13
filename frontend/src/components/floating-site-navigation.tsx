import { ChevronUp, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { IconButton } from '@/components/icon-button';

/** 90px capsule + 16px bottom margin + 12px separation from other docks. */
export const SITE_NAVIGATION_BOTTOM_INSET = 118;

interface FloatingSiteNavigationProps {
  onPrevious?: () => void;
  onNext?: () => void;
  /** Defaults to the lower left inside the containing positioned element. */
  outsideLeft?: boolean;
}

export function FloatingSiteNavigation({ onPrevious, onNext, outsideLeft = false }: FloatingSiteNavigationProps) {
  const { t } = useTranslation();
  const buttonClass = 'h-10 w-10 rounded-md text-slate-500 hover:bg-brand-50 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-35 disabled:cursor-default dark:text-slate-400 dark:hover:bg-slate-800';
  return (
    <nav aria-label={t('previewActions.siteNavigation')} data-site-navigation
      className={`absolute bottom-4 left-0 z-50 flex flex-col gap-0 p-1 rounded-r-xl border border-l-0 border-slate-200/60 bg-white/90 shadow-[0_4px_16px_rgba(0,0,0,0.1)] backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/90 ${outsideLeft ? 'rounded-l-xl rounded-r-none border-r-0 border-l translate-x-[calc(-100%+1px)]' : ''}`}>
      <IconButton label={t('previewActions.previousSite')} size="auto" tooltipSide="right" type="button" disabled={!onPrevious} onClick={onPrevious} className={buttonClass}>
        <ChevronUp className="h-5 w-5" />
      </IconButton>
      <IconButton label={t('previewActions.nextSite')} size="auto" tooltipSide="right" type="button" disabled={!onNext} onClick={onNext} className={buttonClass}>
        <ChevronDown className="h-5 w-5" />
      </IconButton>
    </nav>
  );
}
