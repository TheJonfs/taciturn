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
import type { AbilityId, ClassId, ItemId, TeamId, UnitId } from './ids.ts';
import type { MathSkillParameter, MathSkillValue } from './action.ts';
import type { Loadout } from './loadout.ts';
import type { Direction, Position } from './spatial.ts';
import type { BaseStats, Vitals } from './stats.ts';
import type { StatusInstance } from './status.ts';
import type { WorldcraftEffectEntry } from './worldcraft.ts';

export interface UnitClassState {
  readonly currentClass: ClassId;
  // classProgress: Map<ClassId, ClassProgressionState>; — added with the
  // progression session.
}

// Session 55: unit gender. Cosmetic in v1 — it selects which of the two
// per-class portraits renders (each class ships a male and a female portrait).
// Optional: when absent, consumers fall back to the class's default portrait
// (the original art), so existing units/fixtures render unchanged. Modeled as
// a first-class unit attribute (not a render-only flag) so future content can
// gate mechanics on it without a data migration.
export type Gender = 'male' | 'female';

export interface Unit {
  readonly id: UnitId;
  readonly team: TeamId;
  readonly name: string;

  readonly classState: UnitClassState;
  readonly loadout: Loadout;
  readonly equipment: UnitEquipment;

  // Per-unit active-ability allowlist (TABA M2 progression gating). When
  // present, ONLY these ability ids may be invoked via `use_ability` — a
  // command-set member not in the set is "locked" (greyed in the menu,
  // rejected by validation). When ABSENT (`undefined`), every active is
  // usable — the Mage War / demo default, so the engine stays progression-
  // ignorant and only the campaign fold ever stamps it. The engine treats
  // this as an opaque allowlist; it knows nothing of JP. See the M2
  // substrate audit (Option B) and `campaign/progression/usable-actives.ts`.
  readonly usableActives?: ReadonlySet<AbilityId>;

  // Per-unit combinator-component allowlists (TABA M2 progression gating) —
  // the item / math-parameter / math-value siblings of `usableActives`. Same
  // opaque-allowlist contract: when present, only these components are usable
  // (locked ones greyed in the Compound / Math pickers, rejected by the
  // matching validators); when ABSENT (`undefined`), all are usable (Mage War /
  // demo default). The combinators (Compound/Throw Item, Math cast) stay
  // always-on shells reading whatever these permit. See
  // `campaign/progression/usable-actives.ts`.
  readonly usableItems?: ReadonlySet<ItemId>;
  readonly usableMathParameters?: ReadonlySet<MathSkillParameter>;
  readonly usableMathValues?: ReadonlySet<MathSkillValue>;

  // Cosmetic gender (Session 55) — selects the male/female portrait variant.
  // Optional; absent means "the class's default portrait." See `Gender`.
  readonly gender?: Gender;

  // TABA (ADR-0136 completion): an ENDURING portrait override key. A cosmetic
  // opaque field the engine CARRIES BUT NEVER INTERPRETS — the exact `gender`
  // precedent (S55). When present, the renderer resolves this bespoke plot face
  // (via `resolveUnitPortrait` → `FIXED_PORTRAITS`) instead of the class+gender
  // portrait, so a plot character keeps their face across reclassing. Absent for
  // generic units → class-derived portrait. Placeholder-tolerant: an unregistered
  // key falls back to the class portrait, so art can land incrementally.
  readonly portrait?: string;

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

  // Session 49 `baseStats` are level-derived. NON-readonly so a mid-battle
  // level-up (TABA M2, `system_xp_award`) can swap them to the next
  // precomputed entry. Every other mutator treats them as fixed.
  baseStats: BaseStats;
  vitals: Vitals;

  // TABA M2 mid-battle XP. `xp` is the accumulating job/level XP (mutable;
  // seeded from the durable unit's carry, 0 for non-campaign units). It rolls
  // over `per_level` on each level-up. `statsByLevel` maps each level ABOVE
  // the unit's current one to its precomputed `BaseStats` (built content-side
  // in the campaign fold, since the engine can't run the stat curve). Its
  // PRESENCE is the opt-in: a unit without it never earns XP or levels (Mage
  // War / demo). Bounded (a few levels — see the fold's precompute depth); an
  // exhausted table just stops leveling (surplus XP carries to the boundary).
  xp: number;
  readonly statsByLevel?: ReadonlyMap<number, BaseStats>;

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

  // Per-unit Worldcraft effect queue (Session 53, ADR-0088). The bounded,
  // ordered list of terrain effects this unit has cast (Pillar/Pit/Hill/
  // Valley/Barrier). Parallel to `statuses`: array order is LIFO-eviction
  // order (index 0 = oldest), Barrier TTLs decrement on the turn loop, and
  // the cap is the computed `worldcraft_effect_cap`. Empty for every unit
  // until it casts a Worldcraft ability (S54). Effects persist past the
  // caster's KO (per blueprint) — the queue is not cleared on KO.
  readonly worldcraftEffects: ReadonlyArray<WorldcraftEffectEntry>;

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

  // Airborne (Session 62, Dragoon Jump / ADR-0103). Transient: set when a
  // unit commits the off-field Jump leap (charged), cleared when the leap
  // resolves. An airborne unit is UNTARGETABLE — excluded from target
  // eligibility and AoE affected-sets (it's mid-air, can't be hit) — but
  // keeps its takeoff position (the tile stays reserved; `unitAt` /
  // occupancy are unchanged, so it lands back home with no conflict).
  // Turn-skipping is handled by the Charging status, as for any charge, so
  // this flag does NOT touch the scheduler. Unlike `removed` (permadeath),
  // it is temporary and the unit is alive throughout.
  readonly airborne: boolean;
}
