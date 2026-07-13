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
import type { DamageTag } from './damage.ts';
import type { UnitEquipment } from './equipment-slot.ts';
import type { AbilityId, ClassId, ItemId, RulesetId, TeamId, UnitId } from './ids.ts';
import type { MathSkillParameter, MathSkillValue } from './action.ts';
import type { Gender } from './unit.ts';
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
  // Optional per ADR-0028 — when omitted, `createInitialState` fills
  // current HP and current MP from the computed effective maxes (base
  // + equipment + class + free-passive contributions). Authors who
  // want a unit to start damaged still pass `vitals` explicitly.
  readonly vitals?: Vitals;
  readonly loadout: Loadout;
  // Equipment placed into the unit's five slots. Slot kind validation
  // (weapons in hand slots, headgear in headgear slot, etc.) happens
  // in `createInitialState`. Optional — when omitted, the unit walks
  // in unequipped (empty equipment map). Per ADR-0028.
  readonly equipment?: UnitEquipment;
  readonly statuses?: ReadonlyArray<StatusInstance>;
  readonly resistances?: ReadonlyMap<DamageTag, number>;
  readonly initialCT?: number;
  // Session 49: slot-based level. Optional — when omitted, the unit is
  // L25 (baseline). The team-builder pipeline derives this from slot
  // index via `slotLevelFor`; demo / hand-authored battles can leave it
  // off and accept the baseline. `baseStats` should already reflect the
  // level modifier when present (the team-builder calls `buildBaseStats`
  // with the level), so this field is informational from the engine's
  // perspective except where Math Skill's `parameter: 'level'`
  // predicate reads it off the resulting Unit.
  readonly level?: number;
  // Session 55: cosmetic gender → portrait variant. Optional; absent means
  // the class's default portrait. Threaded through to `Unit.gender`.
  readonly gender?: Gender;
  // TABA (ADR-0136 completion): enduring portrait override key, threaded to
  // `Unit.portrait`. Optional; absent → class+gender portrait. The campaign fold
  // stamps it from the durable `CampaignUnit.portrait`; MW/demo omit it.
  readonly portrait?: string;
  // TABA M2 progression: per-unit active-ability allowlist. Optional — when
  // omitted (Mage War / demo / hand-authored battles), every active is usable
  // (`Unit.usableActives` stays `undefined`). The campaign fold stamps it from
  // the durable unit's unlocked set; `createInitialState` threads it onto the
  // `Unit` as a `Set`. Plain array here (declarative config); see `Unit`.
  readonly usableActives?: ReadonlyArray<AbilityId>;
  // TABA M2: combinator-component allowlists (Alchemist items; Calculator math
  // parameters/values). Optional — omitted ⇒ all usable. Threaded onto the
  // `Unit` as Sets; the campaign fold stamps them from the durable unlocks.
  readonly usableItems?: ReadonlyArray<ItemId>;
  readonly usableMathParameters?: ReadonlyArray<MathSkillParameter>;
  readonly usableMathValues?: ReadonlyArray<MathSkillValue>;
  // TABA M2 mid-battle XP. `xp` seeds the unit's XP carry (default 0).
  // `statsByLevel` are the precomputed `BaseStats` for the CONSECUTIVE levels
  // above `level` (index 0 = level+1, 1 = level+2, …). Optional — omitted ⇒ the
  // unit never levels (Mage War / demo). `createInitialState` re-keys the array
  // to an absolute-level `Map` on the `Unit`.
  readonly xp?: number;
  readonly statsByLevel?: ReadonlyArray<BaseStats>;
  // Ch1 substrate: death protection (cutscene-immortal bosses). A
  // would-be-lethal hit retreats the unit instead of KO'ing it — see
  // `Unit.deathProtected`. Hand-authored on story-battle placements;
  // the campaign fold never sets it on player units.
  readonly deathProtected?: true;
  // Ch1 substrate (WI4): guest ally — player-side, AI-driven,
  // uncontrolled, battle-long. Team stays the player's (friend/foe,
  // heals, win/loss all read the real team); only CONTROL routes to the
  // AI (orchestrator + turn-flow read the flag). The campaign fold
  // treats guest placements as fixed authored units, not deploy slots.
  readonly guest?: true;
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

  // Opaque per-battle scalar threaded onto `GameState.scenarioTier` (which the
  // engine carries but never interprets — see game-state.ts). The TABA campaign
  // fold sets this to the node's chapter number so chapter-scaling signature
  // abilities read a battle-wide magnitude; Mage War / demo / test configs omit
  // it and run at `DEFAULT_SCENARIO_TIER`. Optional per the "campaign enriches,
  // engine defaults" rule.
  readonly scenarioTier?: number;

  // Per-action seed derivation root. Same input + same masterSeed always
  // produces the same battle outcome (per docs/design/action-resolution.md
  // "RNG model"). For ad-hoc test battles a fixed seed is fine; live
  // battles draw a fresh seed.
  readonly masterSeed: number;
}
