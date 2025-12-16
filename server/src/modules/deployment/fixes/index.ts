import type { RepoFix } from './types.js';
import { missingHtmlEntryScriptFix } from './missingHtmlEntryScript.js';
import { addGeminiEnvPlaceholderFix } from './addGeminiEnvPlaceholder.js';
import { adjustDistAssetsForLocalPreviewFix } from './adjustDistAssetsForLocalPreview.js';
import { rewriteGenAIBaseUrlFix } from './rewriteGenAIBaseUrl.js';

// Central registry for all repository fixes.
export const FIXES: RepoFix[] = [
  // Pre-build fixes
  missingHtmlEntryScriptFix,
  addGeminiEnvPlaceholderFix,
  rewriteGenAIBaseUrlFix,
  // Post-build fixes (require ctx.distDir)
  adjustDistAssetsForLocalPreviewFix,
];
