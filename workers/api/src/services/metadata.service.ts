import type { ApiWorkerEnv } from '../types/env';
import {
  SourceType,
  type ProjectMetadataOverrides,
  type ResolvedProjectMetadata,
} from '../types/project';
import { slugify, trimWhitespace } from '../utils/strings';
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

function buildInlineHtmlContext(htmlContent?: string): string | undefined {
  if (!htmlContent) return undefined;
  const normalized = trimWhitespace(htmlContent);
  return normalized.length > 0 ? normalized.slice(0, 2000) : undefined;
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
    const name = normalizeName(seedName, overrides?.name);
    const description = normalizeDescription(overrides?.description);
    const category = normalizeCategory(overrides?.category);
    const tags = normalizeTags(overrides?.tags);
    const slugCandidate = deriveSlugSeed(overrides, name, slugSeed);

    return {
      name,
      description,
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
