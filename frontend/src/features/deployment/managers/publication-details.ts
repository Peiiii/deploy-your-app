import { SourceType } from '@/types';
import type { useDeploymentStore } from '../stores/deployment.store';

type PublicationState = ReturnType<typeof useDeploymentStore.getState>;

function getSourceName(state: PublicationState): string | undefined {
  if (state.sourceType === SourceType.GITHUB) return state.repoUrl.split('/').filter(Boolean).pop()?.replace(/\.git$/, '');
  if (state.sourceType === SourceType.ZIP) return state.zipFile?.name.replace(/\.zip$/i, '');
  return state.htmlContent.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1].replace(/<[^>]*>/g, '').trim().slice(0, 80);
}

export function getPublicationName(state: PublicationState): string {
  return state.projectName.trim() || getSourceName(state) || (state.sourceType === SourceType.HTML ? 'my-html-app' : 'my-app');
}

export function isValidPublicationSlug(slug: string): boolean {
  return slug.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug);
}

export function getPublicationSlug(state: PublicationState): string {
  if (state.publicationSlug !== null) return state.publicationSlug;
  const name = state.projectName.trim() || getSourceName(state) || '';
  const generated = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63).replace(/-+$/g, '');
  return generated || state.addressSeed;
}
