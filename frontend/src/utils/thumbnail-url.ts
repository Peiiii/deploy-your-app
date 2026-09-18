export const getProjectThumbnailUrl = (projectUrl: string | undefined): string | null => {
  if (!projectUrl) return null;
  try {
    const url = new URL(projectUrl);
    if (url.hostname.endsWith('.gemigo.app')) {
      const slug = url.hostname.slice(0, -'.gemigo.app'.length);
      if (/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)) {
        return `https://assets.gemigo.app/thumbnails/${encodeURIComponent(slug)}.webp`;
      }
    }
    return new URL('__thumbnail.png', url).toString();
  } catch {
    return null;
  }
};
