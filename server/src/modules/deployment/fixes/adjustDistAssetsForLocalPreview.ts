import * as fs from 'fs';
import * as path from 'path';
import type { RepoFix, RepoFixContext } from './types.js';

// Fix: in local preview mode, adjust dist/index.html so that asset paths
// like src="/assets/..." and href="/assets/..." become relative "./assets/...".
// This allows apps to work when served from a non-root path (/apps/<slug>/)
// during local development.
export const adjustDistAssetsForLocalPreviewFix: RepoFix = {
  id: 'adjust-dist-assets-for-local-preview',
  description:
    'Rewrite absolute /assets/... paths in dist/index.html to ./assets/... for local preview under /apps/<slug>.',

  async detect(ctx: RepoFixContext): Promise<boolean> {
    // Only apply in non-production (local) environments.
    if (process.env.NODE_ENV === 'production') {
      return false;
    }

    if (!ctx.distDir) {
      return false;
    }

    const indexPath = path.join(ctx.distDir, 'index.html');
    if (!fs.existsSync(indexPath)) {
      return false;
    }

    const html = await fs.promises.readFile(indexPath, 'utf8');

    // Look for absolute asset references.
    const hasAbsoluteAssets =
      /(?:src|href)=["']\/assets\//i.test(html) ||
      /url\(["']?\/assets\//i.test(html);

    return hasAbsoluteAssets;
  },

  async apply(ctx: RepoFixContext): Promise<void> {
    if (!ctx.distDir) return;

    const indexPath = path.join(ctx.distDir, 'index.html');
    const html = await fs.promises.readFile(indexPath, 'utf8');

    // Replace src="/assets/... -> src="./assets/...
    // Replace href="/assets/... -> href="./assets/...
    // Replace url('/assets/...) -> url('./assets/...)
    let updated = html.replace(
      /(src|href)=["']\/(assets\/[^"']*)["']/gi,
      '$1="./$2"',
    );

    updated = updated.replace(
      /url\(\s*["']?\/(assets\/[^"')]*)(["']?\s*\))/gi,
      'url("./$1"$2)',
    );

    await fs.promises.writeFile(indexPath, updated, 'utf8');
  },
};

