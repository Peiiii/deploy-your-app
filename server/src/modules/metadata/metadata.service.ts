import { CONFIG } from '../../common/config/config.js';
import { getAIService } from '../ai/ai.service.js';
import {
  buildInlineHtmlContext,
  buildStoredAppContext,
  buildWorkDirContext,
} from './metadataContext.js';
import { SourceType } from '../../common/types.js';
import { slugify } from '../../common/utils/strings.js';

export interface ProjectMetadataOverrides {
  name?: string;
  slug?: string;
  description?: string;
  category?: string;
  tags?: string[];
}

export interface ResolvedProjectMetadata {
  name: string;
  slug: string;
  description?: string;
  category: string;
  tags: string[];
}

interface MetadataRequestInput {
  seedName: string;
  identifier: string;
  sourceType: SourceType;
  htmlContent?: string;
  slugSeed?: string;
  workDir?: string | null;
  overrides?: ProjectMetadataOverrides;
}

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
    .map((tag) => (typeof tag === 'string' ? tag.trim().toLowerCase() : ''))
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

function deriveIdentifierSeed(identifier: string, fallback: string): string {
  try {
    const url = new URL(identifier);
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length) {
      const last = parts[parts.length - 1];
      return last.replace(/\.git$/, '');
    }
  } catch {
    // Not a URL; fall through.
  }

  const clean = identifier.trim();
  if (clean) {
    const segments = clean.split(/[/\\]/).filter(Boolean);
    if (segments.length) {
      const last = segments[segments.length - 1];
      return last.replace(/\.git$/, '');
    }
  }

  return fallback;
}

async function buildMetadataContext(opts: {
  sourceType: SourceType;
  htmlContent?: string;
  workDir?: string | null;
  slugSeed?: string;
}): Promise<string | undefined> {
  if (opts.sourceType === SourceType.Html) {
    const inline = buildInlineHtmlContext(opts.htmlContent);
    if (inline) return inline;
  }

  if (opts.workDir) {
    const workDirContext = await buildWorkDirContext(opts.workDir);
    if (workDirContext) return workDirContext;
  }

  if (opts.slugSeed) {
    const storedContext = await buildStoredAppContext(
      slugify(opts.slugSeed),
      CONFIG.paths.staticRoot,
    );
    if (storedContext) return storedContext;
  }

  return undefined;
}

export class MetadataService {
  async ensureProjectMetadata(input: MetadataRequestInput): Promise<ResolvedProjectMetadata> {
    const fallbackSlugSeed = input.slugSeed ?? deriveIdentifierSeed(input.identifier, input.seedName);
    if (input.overrides) {
      return this.buildMetadataFromOverrides(input.seedName, fallbackSlugSeed, input.overrides);
    }
    return this.requestMetadataFromAI({
      ...input,
      slugSeed: fallbackSlugSeed,
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
    opts: MetadataRequestInput,
  ): Promise<ResolvedProjectMetadata> {
    const aiService = getAIService();
    const metadataContext = await buildMetadataContext({
      sourceType: opts.sourceType,
      htmlContent: opts.htmlContent,
      workDir: opts.workDir,
      slugSeed: opts.slugSeed,
    });

    const response = await aiService.generateProjectMetadata(
      opts.seedName,
      opts.identifier,
      metadataContext,
    );

    const name = normalizeName(opts.seedName, response.name);
    const description = normalizeDescription(response.description);
    const category = normalizeCategory(response.category);
    const tags = normalizeTags(response.tags);

    const slugSeed = response.slug && response.slug.trim().length > 0
      ? response.slug.trim()
      : opts.slugSeed ?? name ?? opts.seedName;

    const slug = slugify(slugSeed);

    return {
      name,
      slug,
      description,
      category,
      tags,
    };
  }
}

export const metadataService = new MetadataService();
