import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  // Ignore compiled / generated artifacts and cloned user builds.
  globalIgnores([
    'dist',
    'server/dist',
    'packages/**/dist',
    'data',
    'data/builds',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    files: ['desktop/src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // Ignore cloned user repos under .deploy-builds from linting to avoid
    // raising errors on user code we don't control.
    // Also relax any-type rules for bridge layers (SDK & Extension).
    files: [
      '.deploy-builds/**/*.{ts,tsx}',
      'server/routes.ts',
      'packages/extension-sdk/src/**/*.{ts,tsx}',
      'packages/app-sdk/src/**/*.{ts,tsx}',
      'browser-extension/**/*.{ts,tsx}',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'react-refresh/only-export-components': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/exhaustive-deps': 'off',
    },
  },
]);
