import { useState } from 'react';
import { ChevronUp, ChevronDown, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FloatingDock, FloatingDockAction, FloatingDockDivider } from '@/components/floating-dock';
import type { UseFloatingDockOptions } from '@/components/floating-dock/use-floating-dock';
import { LoadingSprite } from '@/components/loading-sprite';

interface FloatingSiteNavigationProps {
  appName: string;
  appUrl?: string;
  faviconUrl?: string;
  onPrevious?: () => void;
  onNext?: () => void;
  dockOptions: UseFloatingDockOptions;
  loading: boolean;
}

export function FloatingSiteNavigation({
  appName,
  appUrl,
  faviconUrl,
  onPrevious,
  onNext,
  dockOptions,
  loading,
}: FloatingSiteNavigationProps) {
  const { t } = useTranslation();
  const [failedIcon, setFailedIcon] = useState<string | null>(null);
  const iconUrl = faviconUrl || (appUrl ? new URL('/favicon.ico', appUrl).href : undefined);
  return (
    <FloatingDock
      dockOptions={dockOptions}
      loading={loading}
      identityLabel={appName}
      label={t('previewActions.siteNavigation')}
      identity={
        loading ? (
          <LoadingSprite compact />
        ) : (
          <>
            {iconUrl && failedIcon !== iconUrl ? (
              <img
                key={iconUrl}
                src={iconUrl}
                alt=""
                aria-hidden="true"
                referrerPolicy="no-referrer"
                className="object-contain"
                onError={() => setFailedIcon(iconUrl)}
              />
            ) : (
              <Globe aria-hidden="true" />
            )}
          </>
        )
      }
    >
      <FloatingDockDivider />
      <FloatingDockAction
        label={t('previewActions.previousSite')}
        disabled={!onPrevious}
        onClick={onPrevious}
      >
        <ChevronUp />
      </FloatingDockAction>
      <FloatingDockAction label={t('previewActions.nextSite')} disabled={!onNext} onClick={onNext}>
        <ChevronDown />
      </FloatingDockAction>
    </FloatingDock>
  );
}
