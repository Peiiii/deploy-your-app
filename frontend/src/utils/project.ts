import { URLS } from '../constants';
import type { Project } from '../types';
import { SourceType } from '../types';

const DEFAULT_AUTHOR = 'Indie Hacker';
const DEFAULT_CATEGORY = 'Other';

function normalizeOptionalLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

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

export function getGitHubUrl(project: Project): string | null {
  if (project.repoUrl.startsWith('draft:')) {
    return null;
  }
  if (project.repoUrl.startsWith(URLS.GITHUB_BASE)) {
    return project.repoUrl;
  }
  if (project.sourceType === SourceType.GITHUB && project.repoUrl) {
    return `${URLS.GITHUB_BASE}${project.repoUrl}`;
  }
  return null;
}

export function getDisplayRepoUrl(repoUrl: string): string {
  if (repoUrl.startsWith(URLS.GITHUB_BASE)) {
    return repoUrl.replace(URLS.GITHUB_BASE, '');
  }
  return repoUrl;
}

export function getProjectThumbnailUrl(projectUrl: string | undefined): string | null {
  if (!projectUrl) return null;
  try {
    return new URL('__thumbnail.png', projectUrl).toString();
  } catch {
    return null;
  }
}

export function getProjectLiveUrl(project: Project): string | null {
  const candidate = project.url ?? project.providerUrl ?? null;
  if (!candidate) return null;
  const normalized = candidate.trim();
  return normalized.length > 0 ? normalized : null;
}

export function buildProjectAuthor(project: Project): string {
  if (
    project.sourceType === SourceType.GITHUB &&
    project.repoUrl.startsWith(URLS.GITHUB_BASE)
  ) {
    const rest = project.repoUrl.replace(URLS.GITHUB_BASE, '');
    const owner = rest.split('/')[0];
    if (owner) return owner;
  }
  return DEFAULT_AUTHOR;
}

/**
 * Project "author" label used in app cards.
 *
 * Decision (product + maintainability):
 * - Prefer platform username/handle when available.
 * - Otherwise fall back to displayName.
 * - Otherwise fall back to GitHub repo owner (when source is GitHub).
 * - Otherwise use a neutral default label.
 */
export function getProjectAuthorLabel(project: Project): string {
  const handle = normalizeOptionalLabel(project.ownerHandle);
  if (handle) return handle;
  const displayName = normalizeOptionalLabel(project.ownerDisplayName);
  if (displayName) return displayName;
  return buildProjectAuthor(project);
}

/**
 * Identifier used for linking to the author's public profile (/u/:identifier).
 * Prefer handle (stable + user-facing), fall back to internal ownerId.
 */
export function getProjectAuthorProfileIdentifier(project: Project): string | undefined {
  const handle = normalizeOptionalLabel(project.ownerHandle);
  if (handle) return handle;
  const ownerId = normalizeOptionalLabel(project.ownerId);
  return ownerId ?? undefined;
}

export function getProjectCategory(project: Project): string {
  return project.category && project.category.trim().length > 0
    ? project.category
    : DEFAULT_CATEGORY;
}

export function buildProjectDescription(project: Project): string {
  const frameworkPart =
    project.framework === 'Unknown' ? 'AI app' : `${project.framework} app`;
  const sourcePart =
    project.sourceType === SourceType.ZIP
      ? 'uploaded as a ZIP archive'
      : project.sourceType === SourceType.GITHUB
        ? 'connected from GitHub'
        : project.sourceType === SourceType.HTML
          ? 'built from inline HTML'
          : 'deployed with GemiGo';
  return `Deployed ${frameworkPart} ${sourcePart}.`;
}

export function getProjectDescription(project: Project): string {
  return project.description && project.description.trim().length > 0
    ? project.description
    : buildProjectDescription(project);
}
