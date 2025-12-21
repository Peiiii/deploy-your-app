import { Plugin } from 'vite';
import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
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

/**
 * Plugin to copy SDK dist files to demo-apps/sdk/ for development
 */
export function copySDKToDemoApps(rootDir: string): Plugin {
  return {
    name: 'copy-sdk-to-demo-apps',
    buildStart() {
      const sdkSrc = resolve(rootDir, '../packages/extension-sdk/dist');
      const sdkDest = resolve(rootDir, 'demo-apps/sdk');
      
      // Create destination directory if needed
      if (!existsSync(sdkDest)) {
        mkdirSync(sdkDest, { recursive: true });
      }
      
      // Copy SDK files
      const filesToCopy = ['gemigo-extension-sdk.umd.js', 'gemigo-extension-sdk.es.js'];
      let copied = 0;
      
      filesToCopy.forEach(file => {
        const srcPath = resolve(sdkSrc, file);
        if (existsSync(srcPath)) {
          copyFileSync(srcPath, resolve(sdkDest, file));
          copied++;
        }
      });
      
      if (copied > 0) {
        console.log(`✓ Copied ${copied} SDK files to demo-apps/sdk/`);
      } else {
        console.warn('⚠ SDK dist files not found. Run "pnpm build:sdk" first.');
      }
    }
  };
}
