// canCommitAction — controller-side pre-flight check.
//
// Mechanically enforces ADR-0035's "controllers run pre-hooks against
// their proposal before submitting" rule. validateAction is pure
// (range, target, budget — no hook side effects), but the engine also
// runs `runOnActionAttempted` at commit time. Status effects like
// Don't Move, Don't Act, and Silence block actions there, not in
// validation. Without this check, controllers propose structurally-
// valid actions that the orchestrator then rejects with a throw.
//
// `runOnActionAttempted` is pure (handlers receive no state and return
// `ActionAttemptResult` only — see `src/engine/hooks/runners.ts`), so
// the pre-flight has the same purity profile as validation.
//
// Treat anything other than `'allowed'` as a filter signal: `'blocked'`
// is the obvious case; `'replaced'` means commit would substitute a
// different action than the one the controller chose, so the controller
// re-derives rather than committing an action it didn't choose.
//
// Promoted in Session 23 from per-controller duplicates in
// `src/ai/basic.ts` and `src/app/demo/controller.ts`. The third
// controller — `src/app/controllers/ui-controller.ts` (via the turn-
// flow hook) — is the trigger ADR-0035 named for this promotion.

import type { Catalog } from '../catalog/index.ts';
import { runOnActionAttempted } from '../hooks/runners.ts';
import type { GameState, ProposedAction, Unit } from '../types/index.ts';
import { validateAction } from './validate.ts';

export function canCommitAction(
  state: GameState,
  catalog: Catalog,
  actor: Unit,
  action: ProposedAction,
): boolean {
  if (!validateAction(state, action, catalog).valid) return false;
  const attempt = runOnActionAttempted(state, catalog, {
    unit: actor,
    action,
    isReaction: false,
  });
  return attempt.kind === 'allowed';
}
