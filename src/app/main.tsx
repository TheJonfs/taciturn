import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { WebGLRenderer } from 'pixi.js';
import { App } from './App.tsx';
import { FormationDevHarness } from './formation/FormationDevHarness.tsx';
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

// Dev-only Formation UI harness (TABA M2): `?formation` mounts a rich seeded
// roster/dossier instead of the app, for building/verifying the celestial UI.
const params = new URLSearchParams(window.location.search);
const useFormationHarness = params.has('formation');

// Dev-only Atlas campaign graph editor (`?atlas`, node-authoring structural
// tier). DEV-gated: the guard is statically false in production builds, so
// the lazy chunk is never emitted there.
const useAtlas = import.meta.env.DEV && params.has('atlas');
const AtlasApp = lazy(() => import('./atlas/AtlasApp.tsx').then((m) => ({ default: m.AtlasApp })));

// Dev-only Cartographer battle-map editor (`?cartographer`, S98 map-authoring
// tier). Same gating pattern as Atlas.
const useCartographer = import.meta.env.DEV && params.has('cartographer');
const CartographerApp = lazy(() =>
  import('./cartographer/CartographerApp.tsx').then((m) => ({ default: m.CartographerApp })),
);

createRoot(rootElement).render(
  <StrictMode>
    {useCartographer ? (
      <Suspense fallback={null}>
        <CartographerApp />
      </Suspense>
    ) : useAtlas ? (
      <Suspense fallback={null}>
        <AtlasApp />
      </Suspense>
    ) : useFormationHarness ? (
      <FormationDevHarness />
    ) : (
      <App />
    )}
  </StrictMode>,
);
