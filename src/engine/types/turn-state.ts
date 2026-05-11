// TurnState — what the engine knows about the *current turn in progress*.
// See docs/design/turn-structure.md ("What is a turn") and
// docs/design/action-resolution.md ("Per-turn budgets").
//
// `null` between turns: when the projection queue advances and the next
// entity to trigger is a charged action, no unit's turn is in progress.
// `currentTurn` is non-null only between `turn_start` and `turn_end`.
//
// `TurnBudget` shape is owned here, not on the ruleset — the ruleset's
// `defaultTurnBudget` produces a TurnBudget at turn_start; per-turn the
// numbers decrement / are zeroed by Wait. Statuses and passives that
// grant extra moves/acts modify these counters at turn_start (via
// onTurnStart hooks in session 7+).

import type { UnitId } from './ids.ts';

// Per-turn budget. Validation gates each action against the relevant
// counter (Move consumes movesAvailable, UseAbility consumes
// actsAvailable). New action-economy mechanics extend by adding
// counters here — every new counter also adds a field to the relevant
// reducer's "budget consumed" knowledge.
export interface TurnBudget {
  readonly movesAvailable: number;
  readonly actsAvailable: number;
}

// What the active unit has committed *during this turn*. Drives the CT
// cost calculation at turn_end (Move-only vs Act-only vs Move+Act vs
// Wait). Re-deriving from the action log is possible but expensive on
// every turn_end; one counter per kind is the lighter shape.
//
// Session 25 removed the decorative `waited: boolean` field — the
// post-MVP turn-end logic (`reduceTurnEnd`) infers the wait branch from
// `movesConsumed === 0 && actsConsumed === 0`, so the flag carried no
// information. Restore it only when a future surface needs to
// distinguish "user clicked Wait" from "engine auto-ended after budget
// exhaustion" beyond what the action log already encodes.
export interface TurnConsumption {
  readonly movesConsumed: number;
  readonly actsConsumed: number;
}

// One unit's turn-in-progress. Constructed at turn_start, cleared at
// turn_end.
export interface CurrentTurn {
  readonly unitId: UnitId;
  readonly budget: TurnBudget;
  readonly consumed: TurnConsumption;
  // Per-unit reaction counter for the chain-termination cap. Reset at
  // each unit's turn_start (per the design's "probably: at the
  // reactor's own turn_start"). Tracks reactions *by* this unit during
  // someone else's turn; not used for the active unit's own actions.
  readonly reactionsUsedThisTurn: ReadonlyMap<UnitId, number>;
}

// `null` between turns; a CurrentTurn while one is in progress.
export type TurnState = CurrentTurn | null;

export const NO_TURN: TurnState = null;
