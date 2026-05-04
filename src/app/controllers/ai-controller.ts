// AiController — adapter from a pure AI decision function to the
// orchestrator's `Controller` interface.
//
// The decision function in `src/ai/` returns `BasicAiDecision`, which is
// structurally a subset of `ControllerDecision` (it omits the
// `'pending'` case — the AI always has an answer). The adapter is a
// thin wrapper, but it keeps the `src/ai/` layer engine-only — this is
// the only place that knows about both the AI and the orchestrator.
//
// Mirror of `ui-controller.ts`'s shape: it adapts a different decision
// source (React clicks vs heuristic logic) to the same `Controller`
// type so both can plug into the same orchestrator wiring.

import { decideBasicAi } from '@ai/index.ts';
import type { Controller } from '../demo/orchestrator.ts';

export function createBasicAiController(): Controller {
  return (state, catalog) => decideBasicAi(state, catalog);
}
