// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

const browserGlobals = { ...globals.browser, ...globals.es2022 };

// Architectural dependency rules from docs/architecture/architecture-overview.md.
// Engine has no dependencies on renderer, ui, ai, app, or rendering libraries.
// AI depends on engine only. Renderer depends on engine only (no React/UI).
// Content is data; it has no runtime dependencies on other layers.
const layerRestrictions = {
  engine: {
    files: ['src/engine/**/*.{ts,tsx}'],
    forbidden: [
      {
        group: ['@renderer/*', '@ui/*', '@ai/*', '@app/*'],
        message: 'Engine must not depend on other layers.',
      },
      {
        group: ['react', 'react-dom', 'react/*', 'react-dom/*', 'pixi.js', 'pixi.js/*'],
        message: 'Engine must not depend on rendering libraries.',
      },
    ],
  },
  ai: {
    files: ['src/ai/**/*.{ts,tsx}'],
    forbidden: [
      { group: ['@renderer/*', '@ui/*', '@app/*'], message: 'AI must depend only on engine.' },
      {
        group: ['react', 'react-dom', 'react/*', 'react-dom/*', 'pixi.js', 'pixi.js/*'],
        message: 'AI must not depend on rendering libraries.',
      },
    ],
  },
  renderer: {
    files: ['src/renderer/**/*.{ts,tsx}'],
    forbidden: [
      { group: ['@ui/*', '@app/*', '@ai/*'], message: 'Renderer reads engine state only.' },
      {
        group: ['react', 'react-dom', 'react/*', 'react-dom/*'],
        message: 'Renderer is PixiJS; React belongs in src/ui.',
      },
    ],
  },
  content: {
    files: ['src/content/**/*.{ts,tsx}'],
    forbidden: [
      {
        group: ['@renderer/*', '@ui/*', '@ai/*', '@app/*'],
        message: 'Content is static data; no cross-layer imports.',
      },
      {
        group: ['react', 'react-dom', 'react/*', 'react-dom/*', 'pixi.js', 'pixi.js/*'],
        message: 'Content must not import runtime libraries.',
      },
    ],
  },
};

const layerConfigs = Object.values(layerRestrictions).map((layer) => ({
  files: layer.files,
  rules: {
    'no-restricted-imports': ['error', { patterns: layer.forbidden }],
  },
}));

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '**/*.tsbuildinfo'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: browserGlobals,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  ...layerConfigs,
  {
    files: ['**/*.{test,spec}.{ts,tsx}'],
    languageOptions: {
      globals: { ...browserGlobals, ...globals.node },
    },
  },
  {
    files: ['*.config.{ts,js}', 'vite.config.ts', 'vitest.config.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
  prettierConfig,
);
