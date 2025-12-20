import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs';

// 复制静态文件到 dist
function copyStaticAssets() {
  return {
    name: 'copy-static-assets',
    closeBundle() {
      // 复制 manifest.json
      copyFileSync('manifest.json', 'dist/manifest.json');
      
      // 复制 icons 目录
      const iconsDir = 'icons';
      const distIconsDir = 'dist/icons';
      if (existsSync(iconsDir)) {
        if (!existsSync(distIconsDir)) {
          mkdirSync(distIconsDir, { recursive: true });
        }
        readdirSync(iconsDir).forEach(file => {
          copyFileSync(`${iconsDir}/${file}`, `${distIconsDir}/${file}`);
        });
      }
      console.log('✓ Copied manifest.json and icons to dist/');
    }
  };
}

export default defineConfig({
  plugins: [react(), copyStaticAssets()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'sidepanel/index.html'),
        'service-worker': resolve(__dirname, 'background/service-worker.ts'),
        bridge: resolve(__dirname, 'content-scripts/bridge.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'service-worker') {
            return 'background/[name].js';
          }
          if (chunkInfo.name === 'bridge') {
            return 'content-scripts/[name].js';
          }
          return 'sidepanel/[name].js';
        },
      },
    },
  },
});
