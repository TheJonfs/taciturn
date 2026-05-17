import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { WebGLRenderer } from 'pixi.js';
import { App } from './App.tsx';
import { installGlobalErrorListeners } from './error-surface.tsx';

// Pin WebGLRenderer with a runtime reference so the production build
// can't tree-shake the symbol. Pixi v8's `Application.init` calls
// `autoDetectRenderer`, which does
// `await import('./gl/WebGLRenderer.mjs')` internally — a dynamic
// import that Vite chunks into a separate asset. In production on
// Vercel's CDN, the chunk has been observed to load in a way that
// yields `undefined` for the destructured `WebGLRenderer` export:
//
//   "Cannot destructure property 'WebGLRenderer' of '(intermediate
//   value)' as it is undefined"
//
// The static import + void-reference forces Vite to keep WebGLRenderer
// in the bundle graph; the matching `manualChunks` rule in
// `vite.config.ts` co-locates all pixi.js sources into a single chunk
// so the dynamic import resolves to the same module namespace as the
// static one. Per 2026-05-17 playtest incident.
void WebGLRenderer;

// Install before React mounts so any error during the first render or
// the Pixi setup beat is captured. The listeners are idempotent.
installGlobalErrorListeners();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
