import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// The guide reads game content at build time from ../src/content, which
// imports the pure-TS engine via @engine. These aliases mirror the main
// project's vite.config.ts so those imports resolve from guide/.
//
// The guide is read-only with respect to ../src — see guide/CLAUDE.md.

export default defineConfig({
  resolve: {
    alias: {
      '@app': fileURLToPath(new URL('../src/app', import.meta.url)),
      '@engine': fileURLToPath(new URL('../src/engine', import.meta.url)),
      '@ai': fileURLToPath(new URL('../src/ai', import.meta.url)),
      '@renderer': fileURLToPath(new URL('../src/renderer', import.meta.url)),
      '@ui': fileURLToPath(new URL('../src/ui', import.meta.url)),
      '@content': fileURLToPath(new URL('../src/content', import.meta.url)),
    },
  },
  server: {
    // Game content lives outside the guide/ root; allow Vite to read it.
    fs: { allow: ['..'] },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
