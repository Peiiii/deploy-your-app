import i18next from 'i18next';

interface PublicAuthorIdentity {
  id?: string | null;
  displayName?: string | null;
  handle?: string | null;
}

const publicLabel = (value?: string | null): string | undefined => {
  const label = value?.trim();
  // Some identity providers use the email address as the display name.
  return label && !label.includes('@') ? label : undefined;
};

export const getAuthorName = ({ displayName, handle }: PublicAuthorIdentity): string => {
  const name = publicLabel(displayName);
  if (name) return name;
  const username = publicLabel(handle);
  if (username) return `@${username}`;
  return i18next.t('profile.creator', { defaultValue: 'Creator' });
};

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

export const getAuthorInitial = (name: string): string =>
  Array.from(name.replace(/^@/, ''))[0]?.toUpperCase() || 'U';
