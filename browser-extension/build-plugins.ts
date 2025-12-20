import { Plugin } from 'vite';
import { copyFileSync, mkdirSync, existsSync, readdirSync, cpSync } from 'fs';
import { resolve } from 'path';

export function copyExtensionAssets(rootDir: string): Plugin {
  return {
    name: 'copy-extension-assets',
    buildStart() {
      this.addWatchFile(resolve(rootDir, 'manifest.json'));
    },
    closeBundle() {
      // 1. Copy manifest.json
      copyFileSync(resolve(rootDir, 'manifest.json'), resolve(rootDir, 'dist/manifest.json'));
      
      // 2. Copy icons directory
      const iconsDir = resolve(rootDir, 'icons');
      const distIconsDir = resolve(rootDir, 'dist/icons');
      if (existsSync(iconsDir)) {
        if (!existsSync(distIconsDir)) {
          mkdirSync(distIconsDir, { recursive: true });
        }
        readdirSync(iconsDir).forEach(file => {
          copyFileSync(resolve(iconsDir, file), resolve(distIconsDir, file));
        });
      }
      console.log('✓ Copied manifest.json and icons to dist/');
    }
  };
}

