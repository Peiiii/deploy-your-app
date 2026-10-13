import type { Ref } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FloatingDock, FloatingDockAction } from '@/components/floating-dock';
import { getDockedStyle } from '@/components/floating-dock/utils';

interface FloatingSiteNavigationProps {
  onPrevious?: () => void;
  onNext?: () => void;
  outsideLeft?: boolean;
  nodeRef?: Ref<HTMLDivElement>;
}

export function FloatingSiteNavigation({
  onPrevious,
  onNext,
  outsideLeft = false,
  nodeRef,
}: FloatingSiteNavigationProps) {
  const { t } = useTranslation();
  const dockSide = outsideLeft ? 'outside-left' : 'inside-left';
  return (
    <FloatingDock
      nodeRef={nodeRef}
      label={t('previewActions.siteNavigation')}
      dockSide={dockSide}
      style={{ ...getDockedStyle(dockSide, 0), top: 'auto', bottom: 16 }}
    >
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
