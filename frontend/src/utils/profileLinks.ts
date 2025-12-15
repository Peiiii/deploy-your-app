import type { ProfileLink } from '../types';

export type ProfileLinkKind =
  | 'github'
  | 'x'
  | 'website'
  | 'linkedin'
  | 'youtube'
  | 'bilibili'
  | 'other';

const DOMAIN_KIND_MAP: Record<string, ProfileLinkKind> = {
  'github.com': 'github',
  'gitlab.com': 'github',
  'twitter.com': 'x',
  'x.com': 'x',
  'linkedin.com': 'linkedin',
  'youtube.com': 'youtube',
  'youtu.be': 'youtube',
  'bilibili.com': 'bilibili',
};

export function resolveLinkKind(url: string): ProfileLinkKind {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const direct = DOMAIN_KIND_MAP[host];
    if (direct) return direct;
    // Strip first label (e.g. www.github.com -> github.com) and try again.
    const parts = host.split('.');
    if (parts.length > 2) {
      const trimmed = parts.slice(-2).join('.');
      return DOMAIN_KIND_MAP[trimmed] ?? 'website';
    }
    return 'website';
  } catch {
    return 'other';
  }
}

export function getEffectiveLabel(link: ProfileLink): string {
  if (link.label && link.label.trim().length > 0) {
    return link.label.trim();
  }
  const kind = resolveLinkKind(link.url);
  switch (kind) {
    case 'github':
      return 'GitHub';
    case 'x':
      return 'X';
    case 'linkedin':
      return 'LinkedIn';
    case 'youtube':
      return 'YouTube';
    case 'bilibili':
      return 'Bilibili';
    case 'website':
      return 'Website';
    default:
      return 'Link';
  }
}

export function normalizeLinksForDisplay(
  links: ProfileLink[] | null | undefined,
): ProfileLink[] {
  if (!links) return [];
  return links.filter((l) => typeof l.url === 'string' && l.url.trim().length > 0);
}

