import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@app': fileURLToPath(new URL('./src/app', import.meta.url)),
      '@engine': fileURLToPath(new URL('./src/engine', import.meta.url)),
      '@ai': fileURLToPath(new URL('./src/ai', import.meta.url)),
      '@renderer': fileURLToPath(new URL('./src/renderer', import.meta.url)),
      '@ui': fileURLToPath(new URL('./src/ui', import.meta.url)),
      '@content': fileURLToPath(new URL('./src/content', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Co-locate all of pixi.js into a single `pixi` chunk so that
        // Pixi's internal `await import('./gl/WebGLRenderer.mjs')` in
        // `autoDetectRenderer` resolves to the same chunk that the
        // static import in `main.tsx` already loaded. Without this,
        // Rollup splits Pixi's renderer modules into separate code-
        // split chunks; production playtest on Vercel's CDN reported
        // the split-chunk variant resolving to `undefined` for the
        // destructured `WebGLRenderer` export. Per 2026-05-17 incident.
        // A future polish pass can revisit if the resulting chunk size
        // hurts initial load.
        manualChunks(id) {
          if (id.includes('node_modules/pixi.js') || id.includes('node_modules/@pixi/')) {
            return 'pixi';
          }
          return undefined;
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./src/test-setup.ts'],
  },
});
