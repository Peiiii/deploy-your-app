export type CategoryFilter =
  | 'All Apps'
  | 'Development'
  | 'Image Gen'
  | 'Productivity'
  | 'Marketing'
  | 'Legal'
  | 'Fun'
  | 'Other';

export type SortOption = 'popularity' | 'recent';

export const CATEGORIES: readonly CategoryFilter[] = [
  'All Apps',
  'Development',
  'Image Gen',
  'Productivity',
  'Marketing',
  'Legal',
  'Fun',
  'Other',
] as const;



