// Public API of the engine.
// Everything UI, renderer, and AI need from the engine flows through this barrel.
// Subsystem internals live in their respective directories and are not re-exported
// unless they belong to the public surface defined in docs/architecture/architecture-overview.md.

export * from './types/index.ts';
export * from './ct/index.ts';
export * from './catalog/index.ts';
export * from './hooks/index.ts';
export * from './abilities/index.ts';
export * from './actions/index.ts';
export * from './map/index.ts';
export * from './setup/index.ts';
export * from './status/index.ts';
