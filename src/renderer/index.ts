// Public API of src/renderer.
//
// The renderer is read-only with respect to engine state. The App layer
// constructs a `BattleRenderer`, mounts it with the initial state, and
// pushes committed actions into it as the orchestrator drives the
// engine forward. The renderer never calls back into the engine.

export { BattleRenderer, type TileClickHandler } from './battle-renderer.ts';
export { type HighlightKind } from './highlight-layer.ts';
export { type PanInput } from './camera-controller.ts';
