import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useUIStore } from '@/stores/ui.store';
import { usePublicCatalogStore } from './public-catalog.store';

export const PublicCatalog = () => {
  const location = useLocation();
  const language = useUIStore((s) => s.language);
  const result = usePublicCatalogStore((s) => s.result);
  const error = usePublicCatalogStore((s) => s.error);
  const load = usePublicCatalogStore((s) => s.load);
  useEffect(() => {
    const url = new URL(location.pathname + location.search, 'https://gemigo.io');
    if (language === 'zh-CN') url.searchParams.set('lang', language);
    else url.searchParams.delete('lang');
    return load(url);
  }, [location.pathname, location.search, language, load]);
  if (error)
    return (
      <main className="seo-content">
        <h1>{language === 'zh-CN' ? '目录暂时无法加载' : 'Catalog temporarily unavailable'}</h1>
        <a href={location.pathname + location.search}>{language === 'zh-CN' ? '重试' : 'Retry'}</a>
      </main>
    );
  if (!result)
    return (
      <p className="seo-content" role="status">
        {language === 'zh-CN' ? '正在加载公开作品…' : 'Loading public apps…'}
      </p>
    );
  return <div dangerouslySetInnerHTML={{ __html: result.content }} />;
};
