import { useEffect, useState } from 'react';

const POLL_DELAYS_MS = [2500, 4000, 6000, 8000, 10000] as const;
const CENTRAL_THUMBNAIL_PREFIX = 'https://assets.gemigo.app/thumbnails/';

export const useProjectThumbnail = (url: string | undefined, active = true) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!active || !loaded || error || revision || !url?.startsWith(CENTRAL_THUMBNAIL_PREFIX)) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const checkReady = async (attempt: number, wasPending: boolean): Promise<void> => {
      try {
        const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
        if (cancelled) return;

        if (response.status === 200) {
          if (wasPending) {
            setLoaded(false);
            setRevision(Date.now());
          }
          return;
        }

        if (response.status === 202 && attempt < POLL_DELAYS_MS.length) {
          timer = setTimeout(() => {
            void checkReady(attempt + 1, true);
          }, POLL_DELAYS_MS[attempt]);
        }
      } catch {
        // Keep the visible placeholder if readiness cannot be checked.
      }
    };

    void checkReady(0, false);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [active, error, loaded, revision, url]);

  const src = url && revision
    ? `${url}${url.includes('?') ? '&' : '?'}retry=${revision}`
    : url;

  return {
    src,
    loaded,
    error,
    onLoad: () => setLoaded(true),
    onError: () => setError(true),
  };
};
