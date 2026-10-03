import { useLocation } from 'react-router-dom';
import { useUIStore } from '@/stores/ui.store';
import { getSeo, renderSeoContent } from '../../seo.mjs';

export const PublicInfo = ({ path, heading = true }: { path?: string; heading?: boolean }) => {
  const location = useLocation();
  const language = useUIStore((state) => state.language);
  const url = new URL(path || location.pathname, 'https://gemigo.io');
  if (language === 'zh-CN') url.searchParams.set('lang', language);
  // Content is fixed product copy, escaped in the shared public-content owner.
  return <div dangerouslySetInnerHTML={{ __html: renderSeoContent(getSeo(url), heading) }} />;
};
