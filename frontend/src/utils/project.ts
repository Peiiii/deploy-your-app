import { URLS } from '../constants';
import type { Project } from '../types';
import { SourceType } from '../types';
import { resolvePublicAuthorIdentity, type PublicAuthorIdentity } from '@gemigo/public-author';
export { getProjectThumbnailUrl } from './thumbnail-url';
const DEFAULT_CATEGORY = 'Other';

export function formatRepoLabel(project: Project): string | null {
  const { repoUrl, sourceType } = project;
  if (!repoUrl) return null;
  if (repoUrl.startsWith('draft:')) return null;
  if (
    (sourceType === SourceType.ZIP || sourceType === SourceType.HTML) &&
    !repoUrl.startsWith('http')
  ) {
    return repoUrl;
  }
  if (repoUrl.startsWith(URLS.GITHUB_BASE)) {
    const trimmed = repoUrl.replace(URLS.GITHUB_BASE, '');
    return trimmed || repoUrl;
  }
  return repoUrl;
}

export function normalizeGitHubRepoUrl(value: string): string | null {
  const input = value
    .trim()
    .replace(/^git@github\.com:/i, 'https://github.com/')
    .replace(/^github\.com\//i, 'https://github.com/');
  try {
    const url = new URL(input);
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'github.com' ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return null;
    const parts = url.pathname.replace(/\/$/, '').slice(1).split('/');
    if (parts.length !== 2) return null;
    const [owner, rawRepo] = parts;
    const repo = rawRepo.replace(/\.git$/, '');
    if (
      !/^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(owner) ||
      !/^[\w.-]+$/.test(repo) ||
      repo === '.' ||
      repo === '..'
    )
      return null;
    return `https://github.com/${owner}/${repo}`;
  } catch {
    return null;
  }
}

export function getGitHubUrl(project: Project): string | null {
  return normalizeGitHubRepoUrl(project.repoUrl);
}

export function getDisplayRepoUrl(repoUrl: string): string {
  if (repoUrl.startsWith(URLS.GITHUB_BASE)) {
    return repoUrl.replace(URLS.GITHUB_BASE, '');
  }
  return repoUrl;
}

export function getProjectLiveUrl(project: Project): string | null {
  const candidate = project.url ?? project.providerUrl ?? null;
  if (!candidate) return null;
  const normalized = candidate.trim();
  return normalized.length > 0 ? normalized : null;
}

/**
 * Prefer the API's semantic identity. The local resolver keeps mixed-version
 * deployments working while the API and frontend roll out independently.
 */
export function getProjectPublicAuthor(project: Project): PublicAuthorIdentity {
  return (
    project.publicAuthor ??
    resolvePublicAuthorIdentity({
      ownerId: project.ownerId,
      handle: project.ownerHandle,
      displayName: project.ownerDisplayName,
      projectId: project.id,
      sourceType: project.sourceType,
      repoUrl: project.repoUrl,
    })
  );
}

/**
 * Identifier used for linking to the author's public profile (/u/:identifier).
 * Prefer handle (stable + user-facing), fall back to internal ownerId.
 */
export function getProjectAuthorProfileIdentifier(project: Project): string | undefined {
  return getProjectPublicAuthor(project).profileIdentifier ?? undefined;
}

export function getProjectCategory(project: Project): string {
  return project.category && project.category.trim().length > 0
    ? project.category
    : DEFAULT_CATEGORY;
}

export function buildProjectDescription(project: Project): string {
  void project;
  return '';
}

export function getProjectDescription(project: Project): string {
  return project.description && project.description.trim().length > 0
    ? project.description
    : buildProjectDescription(project);
}
