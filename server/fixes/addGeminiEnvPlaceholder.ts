import * as fs from 'fs';
import * as path from 'path';
import type { RepoFix, RepoFixContext } from './types.js';

// Temporary fix: ensure a .env file exists with a placeholder GEMINI_API_KEY.
// This prevents builds that rely on GEMINI_API_KEY from failing outright.
export const addGeminiEnvPlaceholderFix: RepoFix = {
  id: 'add-gemini-env-placeholder',
  description:
    'Ensure .env exists with a placeholder GEMINI_API_KEY=xxx for local builds.',

  async detect(ctx: RepoFixContext): Promise<boolean> {
    const envPath = path.join(ctx.workDir, '.env');

    if (!fs.existsSync(envPath)) {
      return true;
    }

    const content = await fs.promises.readFile(envPath, 'utf8');
    const hasGeminiKey = /^GEMINI_API_KEY\s*=/m.test(content);

    return !hasGeminiKey;
  },

  async apply(ctx: RepoFixContext): Promise<void> {
    const envPath = path.join(ctx.workDir, '.env');

    if (!fs.existsSync(envPath)) {
      const header = '# Temporary placeholder injected by deploy-your-app\n';
      const line = 'GEMINI_API_KEY=xxx\n';
      await fs.promises.writeFile(envPath, header + line, 'utf8');
      return;
    }

    const content = await fs.promises.readFile(envPath, 'utf8');
    const appended =
      content.replace(/\s*$/, '\n') +
      '# Temporary placeholder injected by deploy-your-app\n' +
      'GEMINI_API_KEY=xxx\n';

    await fs.promises.writeFile(envPath, appended, 'utf8');
  },
};

