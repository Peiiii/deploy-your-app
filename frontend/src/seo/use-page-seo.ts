import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUIStore } from '@/stores/ui.store';
import { getSeo, renderSeoHead } from '../../seo.mjs';

export const usePageSeo = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const language = useUIStore((state) => state.language);
  useEffect(() => {
    const url = new URL(location.pathname + location.search, 'https://gemigo.io');
    const initial = getSeo(url);
    if (initial.indexable) {
      if (language === 'zh-CN') url.searchParams.set('lang', 'zh-CN');
      else url.searchParams.delete('lang');
      if (url.search !== location.search) {
        navigate(url.pathname + url.search + location.hash, { replace: true });
        return;
      }
    }
    const seo = getSeo(url);
    document.documentElement.lang = language === 'zh-CN' ? 'zh-CN' : 'en';
    document.head.querySelectorAll('[data-seo]').forEach((element) => element.remove());
    const template = document.createElement('template');
    template.innerHTML = renderSeoHead(seo);
    document.head.append(template.content);
  }, [location.pathname, location.search, location.hash, language, navigate]);
};
