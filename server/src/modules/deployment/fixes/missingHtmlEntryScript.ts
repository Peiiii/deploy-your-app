import * as fs from 'fs';
import * as path from 'path';
import type { RepoFix, RepoFixContext } from './types.js';

// Fix: index.html has a root element but no module script,
// while an index.tsx entry file exists. Inject a script tag
// so tools like Vite can treat it as the entry.
export const missingHtmlEntryScriptFix: RepoFix = {
  id: 'missing-html-entry-script',
  description:
    'Inject <script type="module" src="./index.tsx"> into index.html when an index.tsx entry exists but no module script is present.',

  async detect(ctx: RepoFixContext): Promise<boolean> {
    const htmlPath = path.join(ctx.workDir, 'index.html');
    const entryPath = path.join(ctx.workDir, 'index.tsx');

    if (!fs.existsSync(htmlPath) || !fs.existsSync(entryPath)) {
      return false;
    }

    const html = await fs.promises.readFile(htmlPath, 'utf8');

    // Already has a module script pointing at index.{ts,tsx,js,jsx}? Then skip.
    const hasModuleScript = /<script[^>]+type=["']module["'][^>]*src=/i.test(
      html,
    );
    const referencesIndex =
      /src=["']\.\/index\.(t|j)sx?["']/i.test(html) ||
      /src=["']\/index\.(t|j)sx?["']/i.test(html);

    if (hasModuleScript && referencesIndex) {
      return false;
    }

    // Only apply this fix if there is a root element.
    const hasRootDiv = /<div[^>]+id=["']root["'][^>]*>/i.test(html);

    return hasRootDiv;
  },

  async apply(ctx: RepoFixContext): Promise<void> {
    const htmlPath = path.join(ctx.workDir, 'index.html');
    const html = await fs.promises.readFile(htmlPath, 'utf8');

    const scriptTag =
      '    <script type="module" src="./index.tsx"></script>\n';

    let updated: string;
    const bodyCloseIdx = html.lastIndexOf('</body>');
    if (bodyCloseIdx !== -1) {
      updated =
        html.slice(0, bodyCloseIdx) +
        scriptTag +
        html.slice(bodyCloseIdx);
    } else {
      updated = html + '\n' + scriptTag;
    }

    await fs.promises.writeFile(htmlPath, updated, 'utf8');
  },
};

