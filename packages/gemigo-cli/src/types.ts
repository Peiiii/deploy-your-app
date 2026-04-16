export interface ManifestLocaleEntry {
  name: string;
  description?: string;
}

export interface GemigoManifest {
  sourceDir?: string;
  slug?: string;
  visibility: 'public' | 'private';
  category: string;
  tags: string[];
  defaultLocale: string;
  locales: Record<string, ManifestLocaleEntry>;
}

export interface CliUser {
  id: string;
  email: string | null;
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface StoredSession {
  origin: string;
  cookie: string;
  user: CliUser;
  updatedAt: string;
}

export interface ProjectLocalizationPayload {
  defaultLocale: string;
  locales: Record<string, ManifestLocaleEntry>;
}

export interface CreateProjectPayload {
  name: string;
  identifier: string;
  sourceType: 'zip';
  isPublic: boolean;
  metadata: {
    name: string;
    slug?: string;
    description?: string;
    category: string;
    tags: string[];
    localization: ProjectLocalizationPayload;
  };
}

export interface ProjectResponse {
  id: string;
  name: string;
  slug?: string;
  url?: string;
}
