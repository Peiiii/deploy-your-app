export const sections = [
  'dashboard',
  'growth',
  'seo',
  'projects',
  'feedback',
  'users',
  'deployments',
  'overview',
  'features',
  'funnels',
  'events',
  'settings',
  'security',
  'audit',
];
export type Navigate = (section: string, id?: string, owner?: string) => void;
export const destination = () => {
  const [section, encodedId = '', query = ''] = window.location.hash.slice(1).split('/');
  if (!sections.includes(section)) return { section: 'dashboard', id: '', owner: '' };
  try {
    const id = ['projects', 'feedback'].includes(section)
      ? decodeURIComponent(encodedId).slice(0, 200)
      : '';
    const owner =
      ['feedback', 'projects'].includes(section) ? new URLSearchParams(query).get('owner')?.slice(0, 200) || '' : '';
    return { section, id, owner };
  } catch {
    return { section: 'dashboard', id: '', owner: '' };
  }
};
