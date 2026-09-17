export type PublicAuthorKind = 'profile' | 'repository' | 'anonymous';

export interface PublicAuthorIdentity {
  kind: PublicAuthorKind;
  /** Explicit public label. Anonymous identities are localized by the client. */
  label: string | null;
  /** Public handle without the leading @, when one exists. */
  handle: string | null;
  /** Handle or legacy owner ID used only to build a profile URL. */
  profileIdentifier: string | null;
  /** Opaque, stable value for avatar colors and UI identity. */
  identityKey: string;
  /** Stable public code shown only for anonymous identities. */
  anonymousCode: string | null;
}

export interface PublicAuthorInput {
  ownerId?: string | null;
  displayName?: string | null;
  handle?: string | null;
  projectId?: string | null;
  sourceType?: string | null;
  repoUrl?: string | null;
}

const normalizeText = (value?: string | null): string | null => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

export const normalizePublicLabel = (value?: string | null): string | null => {
  const normalized = normalizeText(value);
  if (!normalized || normalized.includes('@')) return null;
  return Array.from(normalized).some((character) => character.charCodeAt(0) < 32)
    ? null
    : normalized;
};

export const normalizePublicHandle = (value?: string | null): string | null => {
  const normalized = normalizeText(value)?.replace(/^@/, '').toLowerCase() ?? null;
  return normalized && /^[a-z0-9-]{3,24}$/.test(normalized) ? normalized : null;
};

export const createPublicIdentityCode = (seed: string): string => {
  let hash = 0x811c9dc5;
  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).toUpperCase().padStart(6, '0').slice(0, 6);
};

export const getGitHubRepositoryOwner = (
  sourceType?: string | null,
  repoUrl?: string | null,
): string | null => {
  if (sourceType !== 'github' || !repoUrl) return null;
  try {
    const url = new URL(repoUrl);
    if (url.hostname.toLowerCase() !== 'github.com') return null;
    const owner = url.pathname.split('/').filter(Boolean)[0] ?? null;
    return owner && /^[a-zA-Z0-9-]+$/.test(owner) ? owner : null;
  } catch {
    return null;
  }
};

export const resolvePublicAuthorIdentity = (
  input: PublicAuthorInput,
): PublicAuthorIdentity => {
  const ownerId = normalizeText(input.ownerId);
  const displayName = normalizePublicLabel(input.displayName);
  const handle = normalizePublicHandle(input.handle);
  const repositoryOwner = getGitHubRepositoryOwner(input.sourceType, input.repoUrl);
  const seed = ownerId ?? input.projectId ?? handle ?? displayName ?? repositoryOwner ?? 'anonymous';
  const identityKey = createPublicIdentityCode(seed);
  const profileIdentifier = handle ?? ownerId;

  if (displayName) {
    return {
      kind: 'profile',
      label: displayName,
      handle,
      profileIdentifier,
      identityKey,
      anonymousCode: null,
    };
  }

  if (handle) {
    return {
      kind: 'profile',
      label: `@${handle}`,
      handle,
      profileIdentifier,
      identityKey,
      anonymousCode: null,
    };
  }

  // A repository owner is source attribution, not a substitute for the known
  // GemiGo user's identity. Only ownerless legacy records use it as a label.
  if (!ownerId && repositoryOwner) {
    return {
      kind: 'repository',
      label: repositoryOwner,
      handle: null,
      profileIdentifier: null,
      identityKey,
      anonymousCode: null,
    };
  }

  return {
    kind: 'anonymous',
    label: null,
    handle: null,
    profileIdentifier,
    identityKey,
    anonymousCode: identityKey,
  };
};
