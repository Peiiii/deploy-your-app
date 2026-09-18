import type {
  Project,
  ProjectMetadataOverrides,
} from '../types/project';

export type MissingMetadataField =
  | 'slug'
  | 'description'
  | 'category'
  | 'tags';

export interface GeneratedProjectMetadata {
  name?: string | null;
  slug?: string | null;
  description?: string | null;
  category?: string | null;
  tags?: string[] | null;
}

export interface ProjectMetadataContext {
  indexHtml?: string;
  readme?: string;
  packageJson?: {
    description?: string;
  };
}

const MAX_DESCRIPTION_LENGTH = 160;

export class DeploymentMetadataPolicy {
  getMissingFields = (project: Project): MissingMetadataField[] => {
    const fields: MissingMetadataField[] = [];
    const slug = this.normalizeText(project.slug);
    const description = this.normalizeText(project.description);
    const category = this.normalizeText(project.category);
    const tags = this.normalizeTags(project.tags);

    if (!slug || slug.toLowerCase() === 'null') fields.push('slug');
    if (!description) fields.push('description');
    if (!category || category.toLowerCase() === 'other') {
      fields.push('category');
    }
    if (tags.length === 0) fields.push('tags');

    return fields;
  };

  needsEnrichment = (project: Project): boolean =>
    this.getMissingFields(project).length > 0;

  buildPatch = (
    current: Project,
    generated: GeneratedProjectMetadata,
    context: ProjectMetadataContext,
  ): ProjectMetadataOverrides => {
    const missingFields = new Set(this.getMissingFields(current));
    const patch: ProjectMetadataOverrides = {};

    if (missingFields.has('slug')) {
      const slug = this.normalizeText(generated.slug);
      if (slug) patch.slug = slug;
    }

    if (missingFields.has('description')) {
      const description =
        this.normalizeDescription(generated.description) ??
        this.deriveSourceDescription(context);
      if (description) patch.description = description;
    }

    if (missingFields.has('category')) {
      const category = this.normalizeText(generated.category);
      if (category && category.toLowerCase() !== 'other') {
        patch.category = category;
      }
    }

    if (missingFields.has('tags')) {
      const tags = this.normalizeTags(generated.tags);
      if (tags.length > 0) patch.tags = tags;
    }

    return patch;
  };

  private deriveSourceDescription = (
    context: ProjectMetadataContext,
  ): string | undefined => {
    const packageDescription = this.normalizeDescription(
      context.packageJson?.description,
    );
    if (packageDescription) return packageDescription;

    const htmlDescription = this.extractHtmlDescription(context.indexHtml);
    if (htmlDescription) return htmlDescription;

    return this.extractReadmeDescription(context.readme);
  };

  private extractHtmlDescription = (html?: string): string | undefined => {
    if (!html) return undefined;

    const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
    for (const tag of metaTags) {
      const name =
        tag.match(/\b(?:name|property)=["']([^"']+)["']/i)?.[1]?.toLowerCase();
      if (name !== 'description' && name !== 'og:description') continue;
      const content = tag.match(/\bcontent=["']([^"']+)["']/i)?.[1];
      const normalized = this.normalizeDescription(content);
      if (normalized) return normalized;
    }

    const title = this.normalizeDescription(
      html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]
        ?.replace(/<[^>]+>/g, ' '),
    );
    const body = this.normalizeDescription(
      html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>'),
    );

    if (title && body && title.toLowerCase() !== body.toLowerCase()) {
      return this.normalizeDescription(`${title} — ${body}`);
    }
    return title ?? body;
  };

  private extractReadmeDescription = (readme?: string): string | undefined => {
    if (!readme) return undefined;
    const firstMeaningfulLine = readme
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*#+\s*/, '').trim())
      .find((line) => line.length > 20 && !line.startsWith('!['));
    return this.normalizeDescription(firstMeaningfulLine);
  };

  private normalizeDescription = (
    value?: string | null,
  ): string | undefined => {
    const normalized = this.normalizeText(value);
    if (!normalized) return undefined;
    if (normalized.length <= MAX_DESCRIPTION_LENGTH) return normalized;
    return `${normalized.slice(0, MAX_DESCRIPTION_LENGTH - 1).trimEnd()}…`;
  };

  private normalizeText = (value?: string | null): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.replace(/\s+/g, ' ').trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };

  private normalizeTags = (value?: string[] | null): string[] => {
    if (!Array.isArray(value)) return [];
    return value
      .map((tag) => this.normalizeText(tag)?.toLowerCase() ?? '')
      .filter((tag) => tag.length > 0)
      .slice(0, 5);
  };
}

export const deploymentMetadataPolicy = new DeploymentMetadataPolicy();
