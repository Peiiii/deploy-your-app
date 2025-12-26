import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({ include: ['src'] }),
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'gemigo',
      formats: ['umd', 'es'],
      fileName: (format) => `gemigo-app-sdk.${format}.js`,
    },
    rollupOptions: {
      output: {
        // Ensure `window.gemigo` is the SDK instance (default export), not `{ default: ... }`.
        exports: 'default',
      },
      // Don't bundle penpal, we'll include it inline for CDN
      // external: ['penpal'],
    },
  },
});
