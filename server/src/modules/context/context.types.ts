import { SourceType } from '../../common/types.js';

// ============================================================
// Constants
// ============================================================

export const MAX_HTML_LENGTH = 10_000;      // 10KB
export const MAX_README_LENGTH = 5_000;     // 5KB
export const MAX_FILES = 100;
export const MAX_PACKAGE_DEPS = 30;

// ============================================================
// Input Types
// ============================================================

export interface ContextInput {
    repoUrl: string;
    sourceType: SourceType;
    zipData?: string;       // base64 encoded
    htmlContent?: string;   // inline HTML
}

// ============================================================
// Output Types
// ============================================================

export interface PackageJsonInfo {
    name?: string;
    description?: string;
    version?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
}

export interface ProjectContext {
    /** Entry HTML content (truncated) */
    indexHtml?: string;

    /** Parsed package.json info */
    packageJson?: PackageJsonInfo;

    /** File/directory list (limited) */
    directoryTree: string[];

    /** README content (truncated) */
    readme?: string;

    /** Detected framework (react, vue, next, etc.) */
    framework?: string;
}

export interface ContextOutput {
    /** Unique ID to reuse workDir in subsequent deploy */
    contextId: string;

    /** Extracted project context */
    context: ProjectContext;
}

// ============================================================
// Session Storage
// ============================================================

export interface ContextSession {
    workDir: string;
    repoUrl: string;
}
