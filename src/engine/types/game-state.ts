// GameState — the container for everything in a single battle.
// See docs/design/core-types.md ("GameState").
//
// Session 1 has the structural fields needed for CT projection and the
// envelope for everything else. Concrete shapes for `GlobalEffect`
// (session 3+) and `BattleOutcome` arrive when those subsystems land;
// `TurnState` was concretized in session 7 (engine/types/turn-state.ts);
// `BattleOutcome` and `victoryConditions` arrive in session 9 alongside
// the turn-end battle-outcome evaluator.

import type { Action } from './action.ts';
import type { BattleOutcome, VictoryCondition } from './battle-outcome.ts';
import type { ChargedAction } from './charged-action.ts';
import type { RulesetId, UnitId } from './ids.ts';
import type { Team } from './team.ts';
import type { BattleMap } from './tile.ts';
import type { TurnState } from './turn-state.ts';
import type { Unit } from './unit.ts';

// Held by ID; the resolved RulesetDefinition is fetched from the catalog
// per ADR-0008. GameState carries the reference, not the resolved shape,
// so the action log header and cross-battle state stay light.
export interface RulesetRef {
  readonly id: RulesetId;
}

// Placeholder; session 3 introduces the first GlobalEffect kind alongside
// the hook system.
export interface GlobalEffect {
  readonly _placeholder?: never;
}

export interface RngState {
  readonly masterSeed: number;
  readonly nextSeq: number;
}

export interface GameState {
  readonly battleId: string;

  readonly map: BattleMap;
  readonly teams: ReadonlyArray<Team>;
  readonly ruleset: RulesetRef;

  readonly units: ReadonlyMap<UnitId, Unit>;
  readonly chargedActions: ReadonlyArray<ChargedAction>;
  readonly globalEffects: ReadonlyArray<GlobalEffect>;

  // Victory conditions copied from BattleConfig at createInitialState
  // time. The reducer reads them at turn_end via `evaluateBattleOutcome`;
  // first-satisfied-wins per `docs/design/turn-structure.md`.
  readonly victoryConditions: ReadonlyArray<VictoryCondition>;

  readonly tick: number;
  readonly turnState: TurnState;

  readonly rng: RngState;

  readonly actionLog: ReadonlyArray<Action>;

  // `undefined` while the battle is ongoing; set to a `Decided` shape
  // when `battle_end` commits. After it's set, no further actions
  // process — `validateAction` and the chain processor short-circuit.
  readonly outcome?: BattleOutcome;
}
