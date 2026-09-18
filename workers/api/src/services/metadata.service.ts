import type { ApiWorkerEnv } from '../types/env';
import {
  SourceType,
  type ProjectMetadataOverrides,
  type ResolvedProjectMetadata,
} from '../types/project';
import { slugify, trimWhitespace } from '../utils/strings';
import {
  deriveFlatMetadataFromLocalization,
  getDefaultLocalizedFields,
  normalizeProjectLocalization,
} from '../utils/project-localization';
import { aiService } from './ai.service';

const DEFAULT_CATEGORY = 'Other';

function normalizeName(seedName: string, override?: string | null): string {
  if (typeof override !== 'string') return seedName;
  const trimmed = override.trim();
  return trimmed.length > 0 ? trimmed : seedName;
}

function normalizeDescription(value?: string | null): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeCategory(value?: string | null): string {
  if (typeof value !== 'string') return DEFAULT_CATEGORY;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_CATEGORY;
}

function normalizeTags(value?: string[] | null): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((tag) =>
      typeof tag === 'string' ? trimWhitespace(tag).toLowerCase() : '',
    )
    .filter((tag) => tag.length > 0)
    .slice(0, 5);
}

function deriveSlugSeed(
  overrides: ProjectMetadataOverrides | undefined,
  finalName: string,
  fallback: string,
): string {
  if (overrides?.slug && overrides.slug.trim().length > 0) {
    return overrides.slug.trim();
  }
  if (overrides?.name && overrides.name.trim().length > 0) {
    return overrides.name.trim();
  }
  if (finalName && finalName.trim().length > 0) {
    return finalName.trim();
  }
  return fallback;
}

export function buildInlineHtmlContext(
  htmlContent?: string,
): string | undefined {
  if (!htmlContent) return undefined;

  const title = htmlContent
    .match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]
    ?.replace(/<[^>]+>/g, ' ');
  const metaDescription = (htmlContent.match(/<meta\b[^>]*>/gi) ?? [])
    .map((tag) => {
      const name = tag
        .match(/\b(?:name|property)=["']([^"']+)["']/i)?.[1]
        ?.toLowerCase();
      if (name !== 'description' && name !== 'og:description') return '';
      return tag.match(/\bcontent=["']([^"']+)["']/i)?.[1] ?? '';
    })
    .find(Boolean);
  const bodyHtml =
    htmlContent.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ??
    htmlContent.replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, ' ');
  const visibleBody = bodyHtml
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  const normalized = [title, metaDescription, visibleBody]
    .map((value) => trimWhitespace(value ?? ''))
    .filter(Boolean)
    .join('\n');
  return normalized.length > 0 ? normalized.slice(0, 4000) : undefined;
}

interface MetadataRequestInput {
  seedName: string;
  identifier: string;
  sourceType: SourceType;
  htmlContent?: string;
  slugSeed?: string;
  overrides?: ProjectMetadataOverrides;
}

class MetadataService {
  async ensureProjectMetadata(
    env: ApiWorkerEnv,
    input: MetadataRequestInput,
  ): Promise<ResolvedProjectMetadata> {
    const slugSeed = input.slugSeed ?? slugify(input.seedName);
    if (input.overrides) {
      return this.buildMetadataFromOverrides(
        input.seedName,
        slugSeed,
        input.overrides,
      );
    }

    return this.requestMetadataFromAI(env, {
      ...input,
      slugSeed,
    });
  }

  private buildMetadataFromOverrides(
    seedName: string,
    slugSeed: string,
    overrides?: ProjectMetadataOverrides,
  ): ResolvedProjectMetadata {
    const localization = normalizeProjectLocalization(overrides?.localization);
    const defaultLocalizedFields = getDefaultLocalizedFields(localization);
    const localizedFlat = deriveFlatMetadataFromLocalization(localization);
    const name = normalizeName(
      seedName,
      defaultLocalizedFields?.name ?? overrides?.name,
    );
    const description = normalizeDescription(
      defaultLocalizedFields?.description ?? overrides?.description,
    );
    const category = normalizeCategory(overrides?.category);
    const tags = normalizeTags(overrides?.tags);
    const slugCandidate = deriveSlugSeed(overrides, name, slugSeed);

    return {
      name,
      description,
      ...(localizedFlat.defaultLocale
        ? { defaultLocale: localizedFlat.defaultLocale }
        : {}),
      ...(localization ? { localization } : {}),
      category,
      tags,
      slug: slugify(slugCandidate),
    };
  }

  private async requestMetadataFromAI(
    env: ApiWorkerEnv,
    opts: MetadataRequestInput & { slugSeed: string },
  ): Promise<ResolvedProjectMetadata> {
    if (!aiService.isEnabled(env)) {
      return {
        name: opts.seedName,
        slug: slugify(opts.slugSeed),
        description: undefined,
        category: DEFAULT_CATEGORY,
        tags: [],
      };
    }

    const metadataContext =
      opts.sourceType === SourceType.Html
        ? buildInlineHtmlContext(opts.htmlContent)
        : undefined;

    const response = await aiService.generateProjectMetadata(
      env,
      opts.seedName,
      opts.identifier,
      metadataContext,
    );

    const name = normalizeName(opts.seedName, response.name);
    const description = normalizeDescription(response.description);
    const category = normalizeCategory(response.category);
    const tags = normalizeTags(response.tags);
    const slugSeed =
      response.slug && response.slug.trim().length > 0
        ? response.slug.trim()
        : name !== opts.seedName
          ? name
          : opts.slugSeed;

    return {
      name,
      slug: slugify(slugSeed),
      description,
      category,
      tags,
    };
  }
}

export const metadataService = new MetadataService();
