/** Ordered discovery categories; stored codes are independent of display language. */
export const CATEGORIES = [
  'All Apps',
  'Education',
  'Games',
  'Productivity',
  'Creative',
  'Development',
  'Other',
] as const;
export type CategoryFilter = (typeof CATEGORIES)[number];
export const CATEGORY_LABEL_KEYS: Record<CategoryFilter, string> = {
  'All Apps': 'explore.allApps',
  Education: 'explore.education',
  Games: 'explore.games',
  Productivity: 'explore.productivity',
  Creative: 'explore.creative',
  Development: 'explore.development',
  Other: 'explore.other',
};

export function getCategoryLabelKey(category: string): string {
  return CATEGORY_LABEL_KEYS[CATEGORIES.find((value) => value === category) ?? 'Other'];
}
