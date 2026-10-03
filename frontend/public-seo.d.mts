import type { Seo } from './seo.mjs';
export type PublicProject = {
  path: string | null;
  name: string;
  description: string;
  url: string;
  author: { label: string; path: string } | null;
};
export type PublicSeoResult = { seo: Seo; status: number; content: string };
export function publicProjects(items: unknown, language: string): PublicProject[];
export function renderPublicProjects(
  projects: PublicProject[],
  language: string,
  heading?: boolean
): string;
export function profileSeo(base: Seo, data: unknown): PublicSeoResult;
export function catalogSeo(url: URL, data: unknown): PublicSeoResult;
export function loadPublicSeo(
  url: URL,
  backend: string,
  fetcher?: typeof fetch
): Promise<PublicSeoResult | null>;

export function appSeo(base: Seo, data: unknown): PublicSeoResult;
