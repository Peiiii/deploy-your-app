import type { PublicAuthorIdentity } from '@gemigo/public-author';
import type { TFunction } from 'i18next';

export const getAuthorName = (
  identity: PublicAuthorIdentity,
  t: TFunction,
): string =>
  identity.label ??
  t('profile.anonymousCreator', {
    code: identity.anonymousCode ?? identity.identityKey,
    defaultValue: `Creator ${identity.anonymousCode ?? identity.identityKey}`,
  });

const AUTHOR_COLORS = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-rose-600',
  'from-pink-500 to-fuchsia-600',
  'from-cyan-500 to-blue-600',
];

export const getAuthorColor = (identity: string): string => {
  let hash = 0;
  for (const character of identity) hash = (Math.imul(hash, 31) + character.charCodeAt(0)) | 0;
  return AUTHOR_COLORS[(hash >>> 0) % AUTHOR_COLORS.length];
};

export const getAuthorInitial = (name: string, anonymousCode?: string | null): string =>
  Array.from(anonymousCode || name.replace(/^@/, ''))[0]?.toUpperCase() || 'U';
