// Unit — a participant in combat.
// See docs/design/core-types.md ("Unit").
//
// Session 1 carried the CT-relevant fields; session 4 added `classState`
// (just `currentClass` for now); session 5 added `loadout` so the
// ability-slot system has somewhere to read equip state from. Session
// 17c added `equipment` per ADR-0028 — five-slot map (left/right hand,
// headgear, armor, accessory). The grouping shapes match the design
// doc; the deferred fields (`classProgress`, per-command-set `learning`)
// land alongside their owning sessions.

import type { DamageTag } from './damage.ts';
import type { UnitEquipment } from './equipment-slot.ts';
import type { ClassId, ItemId, TeamId, UnitId } from './ids.ts';
import type { Loadout } from './loadout.ts';
import type { Direction, Position } from './spatial.ts';
import type { BaseStats, Vitals } from './stats.ts';
import type { StatusInstance } from './status.ts';

export interface UnitClassState {
  readonly currentClass: ClassId;
  // classProgress: Map<ClassId, ClassProgressionState>; — added with the
  // progression session.
}

export interface Unit {
  readonly id: UnitId;
  readonly team: TeamId;
  readonly name: string;

  readonly classState: UnitClassState;
  readonly loadout: Loadout;
  readonly equipment: UnitEquipment;

  // Slot-based level assignment (Session 49). L25 is the baseline; each
  // step away modifies HP and MP by ±10% and, at ±2 or beyond, the
  // class's dominant stat (per `ClassDefinition.dominantStat`) by ±1.
  // Applied at `buildBaseStats` time (so `baseStats` is already level-
  // adjusted by the time the unit lands here); also stored on the unit
  // so Math Skill's `parameter: 'level'` predicate can read it. Locked
  // at battle start; no in-battle mutation.
  readonly level: number;

  position: Position;
  facing: Direction;

  ct: number;

  readonly baseStats: BaseStats;
  vitals: Vitals;

  // Per-tag resistance map. Sparse — missing tags default to 0 (no
  // resistance). Range per-entry is [-100, 200] per the Battle Mechanics
  // Guide. Composition across sources (class baseline + equipment +
  // statuses) is additive; consumers ship in session 14's resistance
  // stage handler. Multi-tag composition follows ADR-0015 (signed
  // maximum). Effects with the 'healing' tag opt out of resistance
  // modulation entirely (ADR-0016) — the resistance stage handler reads
  // the tag set and short-circuits.
  readonly resistances: ReadonlyMap<DamageTag, number>;

  statuses: ReadonlyArray<StatusInstance>;

  // Per-unit consumable stockpile (Session 39a). The Alchemist's
  // Compound action increments an entry by 1 (paying MP per item type);
  // Throw Item decrements by 1 and applies the item's effect.
  // Conceptually a multiset — missing entries are 0. The map is empty
  // by default; Field Kit (Alchemist Support, S39b) populates the
  // starting entries at battle setup. Cross-class equippers also gain
  // a stockpile when the support equips.
  readonly stockpile: ReadonlyMap<ItemId, number>;

  // Permadeath counter (Session 39a). Increments each time this unit's
  // virtual CT would have crossed the trigger threshold while KO'd.
  // Reset to 0 on revival. At `>= permadeathThreshold` (ruleset, default
  // 3) the unit is `removed` from battle.
  readonly turnsKOd: number;

  // Set true when permadeath fires (Session 39a). A removed unit is
  // filtered from target eligibility, AoE selection, tile occupancy
  // queries, and the scheduler's KO virtual-CT accumulator. Their
  // remaining vitals stay at 0/0 — the `defeat_all` outcome check
  // (which reads `hp > 0`) naturally treats them as defeated. Cannot be
  // revived; Phoenix Down validates against `removed` and refuses.
  readonly removed: boolean;
}
