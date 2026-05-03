// Battle outcome and victory condition shapes.
// See docs/design/turn-structure.md ("Battle outcomes").
//
// Victory conditions are data on the BattleConfig and copied onto
// GameState at createInitialState time so the reducer can read them
// without going back to BattleConfig (which is one-shot input data,
// not part of the running state).
//
// `BattleOutcome` is set on `GameState.outcome` when a victory
// condition is satisfied at turn_end. While ongoing, the field is
// `undefined`; the engine refuses further action commits once the
// field is set.
//
// New victory-condition kinds (survive_turns, reach_tile, protect_unit)
// add as additional discriminants here. Each adds a predicate clause
// in `engine/turn/evaluate-battle-outcome.ts`; the union is closed so
// the evaluator's switch must light up every variant consciously.

import type { TeamId } from './ids.ts';

// Closed union of victory-condition kinds. v1 ships `defeat_all`; the
// other variants in turn-structure.md ("Common conditions") land
// additively as their content needs them.
export type VictoryCondition = {
  readonly kind: 'defeat_all';
  readonly side: TeamId;
  readonly description: string;
};

// Set on `GameState.outcome` when the battle decides. The
// `conditionIndex` references the position in
// `state.victoryConditions` — same condition that fired, replayable.
export interface DecidedOutcome {
  readonly winner: TeamId;
  readonly conditionIndex: number;
  readonly description: string;
}

// What evaluateBattleOutcome returns. Either ongoing (no condition
// satisfied yet) or decided (the first satisfied condition).
export type EvaluatedOutcome =
  | { readonly kind: 'ongoing' }
  | { readonly kind: 'decided'; readonly decided: DecidedOutcome };

// Shape stored on `GameState.outcome` once a battle ends. (Same as
// `DecidedOutcome` — no `kind` discriminant needed because the
// presence/absence of the field on GameState answers ongoing vs.
// decided.)
export type BattleOutcome = DecidedOutcome;
