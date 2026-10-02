import type { ExploreAppCard } from '@/components/explore-app-card';

export { CATEGORIES, type CategoryFilter } from '@/constants/app-categories';

export type SortOption = 'recommended' | 'popularity' | 'recent';

/** Rank candidates without hiding results; diversify the first row by author. */
export function rankHomeRecommendations(apps: ExploreAppCard[]): ExploreAppCard[] {
  const score = (app: ExploreAppCard) => {
    const name = app.name.trim();
    let value = /^app[-_]|^\d+(?:\.\d+)*$|^my[- ](?:app|html)/i.test(name) ? -4 : 2;
    if (app.description?.trim()) value += 1;
    if (/临时|\btemporary\b/i.test(name)) value -= 4;
    if (
      /placeholder|starter|draft|prototype|basic html|likely|reference only|temporary|草稿|原型|临时/i.test(
        app.description ?? ''
      )
    )
      value -= 4;
    return value;
  };
  const ranked = [...apps].sort((a, b) => score(b) - score(a));
  const first: ExploreAppCard[] = [];
  const remaining: ExploreAppCard[] = [];
  const authors = new Set<string>();
  for (const app of ranked) {
    const author = app.author.identityKey;
    if (first.length < 3 && !authors.has(author)) {
      first.push(app);
      authors.add(author);
    } else remaining.push(app);
  }
  return [...first, ...remaining];
}
