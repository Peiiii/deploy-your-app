import { Plugin } from 'vite';
import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { resolve } from 'path';

export function copyExtensionAssets(rootDir: string): Plugin {
  let mode: string | undefined;
  return {
    name: 'copy-extension-assets',
    configResolved(config) {
      mode = config.mode;
    },
    buildStart() {
      this.addWatchFile(resolve(rootDir, 'manifest.json'));
      this.addWatchFile(resolve(rootDir, 'manifest.dev.json'));
    },
    closeBundle() {
      const useDevManifest =
        process.env.GEMIGO_EXTENSION_DEV === '1' || mode === 'development';
      const manifestPath = useDevManifest && existsSync(resolve(rootDir, 'manifest.dev.json'))
        ? resolve(rootDir, 'manifest.dev.json')
        : resolve(rootDir, 'manifest.json');

      // 1. Copy manifest
      copyFileSync(manifestPath, resolve(rootDir, 'dist/manifest.json'));
      
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
      if (useDevManifest) {
        console.log('✓ Using dev manifest (development mode)');
      }
      console.log('✓ Copied manifest and icons to dist/');
    }
  };
}

/**
 * Plugin to copy SDK dist files to demo-apps/sdk/ for development
 */
export function copySDKToDemoApps(rootDir: string): Plugin {
  let mode: string | undefined;
  return {
    name: 'copy-sdk-to-demo-apps',
    configResolved(config) {
      mode = config.mode;
    },
    buildStart() {
      // Only needed for local demo-apps during development.
      if (mode !== 'development') return;

      const sdkSrc = resolve(rootDir, '../packages/app-sdk/dist');
      const sdkDest = resolve(rootDir, 'demo-apps/sdk');
      
      // Create destination directory if needed
      if (!existsSync(sdkDest)) {
        mkdirSync(sdkDest, { recursive: true });
      }
      
      // Copy SDK files
      const filesToCopy = ['gemigo-app-sdk.umd.js', 'gemigo-app-sdk.es.js'];
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
