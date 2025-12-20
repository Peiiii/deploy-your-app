import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({ include: ['src'] }),
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'GemigoExtensionSDK',
      formats: ['umd', 'es'],
      fileName: (format) => `gemigo-extension-sdk.${format}.js`,
    },
    rollupOptions: {
      // Don't bundle penpal, we'll include it inline for CDN
      // external: ['penpal'],
    },
  },
});
