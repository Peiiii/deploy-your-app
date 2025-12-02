import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env vars from the frontend package root (frontend/.env*)
  const env = loadEnv(mode, __dirname, '');

  return {
    // This config file itself lives in the frontend root.
    root: __dirname,
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy: {
        '/api': 'http://localhost:4173',
        '/apps': 'http://localhost:4173',
      },
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
  };
});
