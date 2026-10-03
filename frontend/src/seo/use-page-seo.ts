import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUIStore } from '@/stores/ui.store';
import { usePublicCatalogStore } from './public-catalog.store';
import { usePublicProfileStore } from '@/features/profile/stores/public-profile.store';
import { profileSeo, appSeo } from '../../public-seo.mjs';
import { getSeo, renderSeoHead } from '../../seo.mjs';

export const usePageSeo = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const catalog = usePublicCatalogStore();
  const profile = usePublicProfileStore((s) => s.data);
  const profileError = usePublicProfileStore((s) => s.error);
  const language = useUIStore((state) => state.language);
  useEffect(() => {
    const url = new URL(location.pathname + location.search, 'https://gemigo.io');
    const initial = getSeo(url);
    if (
      initial.indexable ||
      url.pathname === '/catalog' ||
      url.pathname.startsWith('/u/') ||
      url.pathname.startsWith('/app/')
    ) {
      if (language === 'zh-CN') url.searchParams.set('lang', 'zh-CN');
      else url.searchParams.delete('lang');
      if (url.search !== location.search) {
        navigate(url.pathname + url.search + location.hash, { replace: true });
        return;
      }
    }
    if (url.pathname.startsWith('/app/')) return;
    let seo = getSeo(url);
    if (url.pathname === '/catalog') {
      if (catalog.url === url.href && catalog.result) seo = catalog.result.seo;
      else if (
        !catalog.error &&
        document.head.querySelector('meta[name="gemigo:route"]')?.getAttribute('content') ===
          url.pathname
      )
        return;
    }
    if (url.pathname.startsWith('/u/')) {
      const identifier = decodeURIComponent(url.pathname.slice(3));
      const matches = profile && [profile.user.handle, profile.user.id].includes(identifier);
      if (matches && !profileError) seo = profileSeo(seo, profile).seo;
      else if (
        !profileError &&
        document.head.querySelector('meta[name="gemigo:route"]')?.getAttribute('content') ===
          url.pathname
      )
        return;
    }
    writeSeo(seo);
  }, [
    location.pathname,
    location.search,
    location.hash,
    language,
    navigate,
    profile,
    profileError,
    catalog,
  ]);
};

const writeSeo = (seo: ReturnType<typeof getSeo>) => {
  document.documentElement.lang = seo.language;
  document.head.querySelectorAll('[data-seo]').forEach((element) => element.remove());
  const template = document.createElement('template');
  template.innerHTML = renderSeoHead(seo);
  document.head.append(template.content);
};
export const usePublicAppSeo = (app: unknown, error: unknown) => {
  const location = useLocation();
  const language = useUIStore((s) => s.language);
  useEffect(() => {
    const url = new URL(location.pathname + location.search, 'https://gemigo.io');
    if (language === 'zh-CN') url.searchParams.set('lang', language);
    else url.searchParams.delete('lang');
    if (app) writeSeo(appSeo(getSeo(url), app).seo);
    else if (
      error ||
      document.head.querySelector('meta[name="gemigo:route"]')?.getAttribute('content') !==
        url.pathname
    )
      writeSeo(getSeo(url));
  }, [app, error, location.pathname, location.search, language]);
};
