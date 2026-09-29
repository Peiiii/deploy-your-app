import { defineConfig, loadEnv } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import path from 'path';

const cliSkillFileName = 'skills/gemigo-cli/SKILL.md';
const cliSkillSource = path.resolve(__dirname, '../skills/gemigo-cli/SKILL.md');

const publishCliSkill = (): Plugin => ({
  name: 'publish-gemigo-cli-skill',
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      if (request.url?.split('?')[0] !== `/${cliSkillFileName}`) {
        next();
        return;
      }
      response.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      response.end(readFileSync(cliSkillSource));
    });
  },
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: cliSkillFileName,
      source: readFileSync(cliSkillSource),
    });
  },
});

export default defineConfig(({ mode }) => {
  // Load env vars from the frontend package root (frontend/.env*)
  const env = loadEnv(mode, __dirname, '');
  const devApiProxyTarget = env.DEV_API_PROXY_TARGET || 'http://127.0.0.1:8787';

  return {
    // This config file itself lives in the frontend root.
    root: __dirname,
    plugins: [react(), publishCliSkill()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy: {
        '/api': devApiProxyTarget,
        '/apps': 'http://localhost:4173',
      },
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
  };
});
