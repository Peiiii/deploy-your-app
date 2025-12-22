import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyExtensionAssets, copySDKToDemoApps } from './build-plugins';

export default defineConfig({
  plugins: [
    react(),
    copyExtensionAssets(__dirname),
    copySDKToDemoApps(__dirname),
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'sidepanel/index.html'),
        'service-worker': resolve(__dirname, 'background/service-worker.ts'),
        bridge: resolve(__dirname, 'content-scripts/bridge.ts'),
        loader: resolve(__dirname, 'content-scripts/loader.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'service-worker') {
            return 'background/[name].js';
          }
          if (chunkInfo.name === 'bridge' || chunkInfo.name === 'loader') {
            return 'content-scripts/[name].js';
          }
          return 'sidepanel/[name].js';
        },
      },
    },
  },
});
