// BattleConfig — per-battle setup data. See
// docs/architecture/architecture-overview.md ("Rulesets and content")
// and ADR-0008.
//
// The three-layer composition is Ruleset (rules of the game), Catalog
// (static content definitions), and BattleConfig (this file — what
// happens in *this* battle). `createInitialState(battleConfig, catalog)`
// reads the BattleConfig and produces the immutable starting GameState.
//
// Maps are inlined on the BattleConfig in v1. Promoting maps into the
// catalog (so battles reference a `MapId`) lands when real map content
// arrives; until then, every battle carries its own BattleMap. Same
// reasoning as session 5's loadout-on-Unit: defer the indirection until
// a consumer needs it.

import type { VictoryCondition } from './battle-outcome.ts';
import type { ClassId, RulesetId, TeamId, UnitId } from './ids.ts';
import type { Loadout } from './loadout.ts';
import type { Direction, Position } from './spatial.ts';
import type { BaseStats, Vitals } from './stats.ts';
import type { StatusInstance } from './status.ts';
import type { Team } from './team.ts';
import type { BattleMap } from './tile.ts';

// What a single unit looks like as it walks onto the battlefield. Anything
// that might vary per battle goes here; persistent identity (class
// progression, items learned) lives off-battle and is folded in by the
// caller when constructing the placement.
//
// `initialCT` is optional: when omitted, the ruleset's `initialCT`
// formula computes the value. Per-unit overrides are useful for scripted
// openings (a boss that pre-charges before the player arrives).
export interface UnitPlacement {
  readonly id: UnitId;
  readonly name: string;
  readonly team: TeamId;
  readonly classId: ClassId;
  readonly position: Position;
  readonly facing: Direction;
  readonly baseStats: BaseStats;
  readonly vitals: Vitals;
  readonly loadout: Loadout;
  readonly statuses?: ReadonlyArray<StatusInstance>;
  readonly initialCT?: number;
}

// Victory conditions are data-as-config. The shape lives in
// `battle-outcome.ts` alongside the evaluated-outcome / decided-outcome
// shapes; this module just re-exports it for `BattleConfig` callers.
export type { VictoryCondition };

export interface BattleConfig {
  readonly battleId: string;
  readonly rulesetId: RulesetId;

  readonly map: BattleMap;
  readonly teams: ReadonlyArray<Team>;
  readonly units: ReadonlyArray<UnitPlacement>;

  readonly victoryConditions: ReadonlyArray<VictoryCondition>;

  // Per-action seed derivation root. Same input + same masterSeed always
  // produces the same battle outcome (per docs/design/action-resolution.md
  // "RNG model"). For ad-hoc test battles a fixed seed is fine; live
  // battles draw a fresh seed.
  readonly masterSeed: number;
}
