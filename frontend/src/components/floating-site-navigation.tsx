import { useState, type Ref } from 'react';
import { ChevronUp, ChevronDown, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  FloatingDock,
  FloatingDockAction,
  FloatingDockIdentity,
  FloatingDockDivider,
} from '@/components/floating-dock';
import { getDockedStyle } from '@/components/floating-dock/utils';

interface FloatingSiteNavigationProps {
  appName: string;
  appUrl?: string;
  faviconUrl?: string;
  onPrevious?: () => void;
  onNext?: () => void;
  outsideLeft?: boolean;
  nodeRef?: Ref<HTMLDivElement>;
}

export function FloatingSiteNavigation({
  appName,
  appUrl,
  faviconUrl,
  onPrevious,
  onNext,
  outsideLeft = false,
  nodeRef,
}: FloatingSiteNavigationProps) {
  const { t } = useTranslation();
  const [failedIcon, setFailedIcon] = useState<string | null>(null);
  const iconUrl = faviconUrl || (appUrl ? new URL('/favicon.ico', appUrl).href : undefined);
  const dockSide = outsideLeft ? 'outside-left' : 'inside-left';
  return (
    <FloatingDock
      nodeRef={nodeRef}
      label={t('previewActions.siteNavigation')}
      dockSide={dockSide}
      style={{ ...getDockedStyle(dockSide, 0), top: 'auto', bottom: 16 }}
      handle={
        <FloatingDockIdentity label={appName}>
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
        </FloatingDockIdentity>
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
