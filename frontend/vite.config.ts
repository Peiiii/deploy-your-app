import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Load env vars from the frontend package root (frontend/.env*)
  const env = loadEnv(mode, __dirname, '');
  const devApiProxyTarget = env.DEV_API_PROXY_TARGET || 'http://127.0.0.1:8787';

  return {
    // This config file itself lives in the frontend root.
    root: __dirname,
    plugins: [react()],
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
