import { create } from 'zustand';
import { catalogSeo } from '../../public-seo.mjs';
import type { PublicSeoResult } from '../../public-seo.mjs';

export const usePublicCatalogStore = create<{
  url: string;
  result: PublicSeoResult | null;
  error: boolean;
  load: (url: URL) => () => void;
}>((set) => ({
  url: '',
  result: null,
  error: false,
  load: (url) => {
    const controller = new AbortController();
    const page = Math.min(
      10000,
      Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1)
    );
    set({ url: url.href, result: null, error: false });
    void fetch(`/api/v1/projects/explore?pageSize=12&page=${page}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unavailable');
        return response.json();
      })
      .then((data) => {
        if (!controller.signal.aborted) set({ result: catalogSeo(url, data) });
      })
      .catch(() => {
        if (!controller.signal.aborted) set({ error: true });
      });
    return () => controller.abort();
  },
}));
