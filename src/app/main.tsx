import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { installGlobalErrorListeners } from './error-surface.tsx';

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
