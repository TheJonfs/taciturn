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

import type { TeamId, UnitId } from './ids.ts';

// Ch1 substrate: the composable predicate grammar for authored victory
// conditions. Predicates are pure reads of battle state; the evaluator
// (`engine/turn/evaluate-battle-outcome.ts`) owns their semantics:
//
// - `all_defeated` — every unit on `side` is down (hp <= 0, which
//   includes removed/retreated units whose vitals sit at 0).
// - `no_deaths` — no unit on `side` has died this battle. Reads the
//   battle-scoped `Unit.hasDied` flag: set on the hp>0 → 0 transition,
//   NEVER reset (a revived unit still counts as having died), and NOT
//   set by a death-protected retreat (retreat ≠ death).
// - `unit_below_hp` — the target (one unit, or every unit on a side)
//   is below `fraction` of effective max HP, STRICT `<`. A unit that
//   is no longer standing (hp <= 0, removed, or retreated) counts as
//   below any threshold — beaten past the line is still past the line.
// - `all_of` — shallow AND composition (e.g. subdue = no_deaths AND
//   unit_below_hp). No OR variant: an OR is two conditions in the
//   ordered `victoryConditions` list (first-satisfied wins).
export type VictoryPredicate =
  | { readonly kind: 'all_defeated'; readonly side: TeamId }
  | { readonly kind: 'no_deaths'; readonly side: TeamId }
  | {
      readonly kind: 'unit_below_hp';
      readonly target:
        | { readonly kind: 'unit'; readonly unitId: UnitId }
        | { readonly kind: 'side'; readonly side: TeamId };
      readonly fraction: number;
    }
  | { readonly kind: 'all_of'; readonly predicates: ReadonlyArray<VictoryPredicate> };

// Closed union of victory-condition kinds. `defeat_all` is the v1
// shape every existing battle authors (winner derived as "the other
// team"). `predicate` is the Ch1-substrate authored form: an explicit
// winner plus an optional `outcome` tag that the campaign layer
// records (e.g. "ester-good" vs "ester-standard") — the tag rides the
// DecidedOutcome so post-battle content can branch on HOW the battle
// was won, not just who won.
export type VictoryCondition =
  | {
      readonly kind: 'defeat_all';
      readonly side: TeamId;
      readonly description: string;
    }
  | {
      readonly kind: 'predicate';
      readonly predicate: VictoryPredicate;
      readonly winner: TeamId;
      readonly outcome?: string;
      readonly description: string;
    };

// Set on `GameState.outcome` when the battle decides. The
// `conditionIndex` references the position in
// `state.victoryConditions` — same condition that fired, replayable.
// `outcome` is the fired condition's tag when it carried one
// (predicate conditions only; absent for `defeat_all` and untagged
// predicates).
export interface DecidedOutcome {
  readonly winner: TeamId;
  readonly conditionIndex: number;
  readonly description: string;
  readonly outcome?: string;
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
