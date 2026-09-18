interface ProjectThumbnailUrlOptions {
  name?: string;
  seed?: string;
  version?: number;
}

export const getProjectThumbnailUrl = (
  projectUrl: string | undefined,
  options: ProjectThumbnailUrlOptions = {},
): string | null => {
  if (!projectUrl) return null;
  try {
    const url = new URL(projectUrl);
    if (url.hostname.endsWith('.gemigo.app')) {
      const slug = url.hostname.slice(0, -'.gemigo.app'.length);
      if (/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)) {
        const thumbnailUrl = new URL(
          `https://assets.gemigo.app/thumbnails/${encodeURIComponent(slug)}.webp`,
        );
        const name = options.name?.trim();
        const seed = options.seed?.trim();
        if (name) thumbnailUrl.searchParams.set('name', name);
        if (seed) thumbnailUrl.searchParams.set('seed', seed);
        if (options.version) thumbnailUrl.searchParams.set('v', String(options.version));
        return thumbnailUrl.toString();
      }
    }
    return new URL('__thumbnail.png', url).toString();
  } catch {
    return null;
  }
};
