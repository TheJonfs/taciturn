// BuiltTeam — the team builder's output shape and the shape of the
// default team templates.
//
// A `BuiltTeam` is a fully-assembled, ready-to-deploy player team: four
// units, each with a class, base stats, ability loadout, and equipment.
// It deliberately omits position and facing — those are the deployment
// phase's job. The team builder produces a `BuiltTeam`; the default
// templates in this folder export `BuiltTeam`s; `buildTeamBattleConfig`
// (in `src/app/`) folds a `BuiltTeam` into a map's `BattleConfig` by
// generating placements.
//
// `BuiltUnit` carries no `id` — ids are assigned positionally at
// config-build time, so a unit's identity is its slot index, not a
// stored key. Names are cosmetic; templates author them, the builder
// defaults them from the class.

import type {
  BaseStats,
  ClassId,
  Gender,
  Loadout,
  UnitEquipment,
} from '@engine/index.ts';
import { leveledClassStats } from '../classes/stat-curves.ts';

export interface BuiltUnit {
  readonly name: string;
  readonly classId: ClassId;
  readonly baseStats: BaseStats;
  readonly loadout: Loadout;
  readonly equipment: UnitEquipment;
  // Session 55: cosmetic gender → portrait variant. Optional; absent means the
  // class's default portrait (the original art). Templates may omit it and
  // render unchanged; the team builder sets it when the player uses the toggle.
  readonly gender?: Gender;
  // Session 49: slot-based level. L25 is the baseline; values away from
  // 25 modify the unit's HP/MP (±10% per ±1) and the class's dominant
  // stat (±1 at ±2 from baseline). `baseStats` is already level-adjusted
  // when this unit was assembled — `buildBaseStats(..., level)` applies
  // the modifier so consumers see the final values directly. Stored on
  // the unit so Math Skill's `parameter: 'level'` predicate can read it
  // off the resulting `Unit.level` after `createInitialState`.
  readonly level: number;
}

// Session 48: variable-length team — between MIN_TEAM_SIZE and
// MAX_TEAM_SIZE units. The team builder represents in-progress drafts
// with up to MAX_TEAM_SIZE slots (empty slots are valid-but-empty);
// `teamBuilderStateToBuiltTeam` filters empty slots out so a `BuiltTeam`
// only ever holds active units. Pre-S48 this was a fixed 4-tuple.
export interface BuiltTeam {
  readonly name: string;
  readonly units: ReadonlyArray<BuiltUnit>;
}

// S48 team-size bounds. Shared between content (template compliance,
// battle-config wiring) and the team-builder UI's validity layer.
export const MAX_TEAM_SIZE = 5;
export const MIN_TEAM_SIZE = 1;

// Brave / Faith bounds for the team builder's sliders (per the Sessions
// 21+ roadmap). The placement default is 70 (see `demo.ts`'s
// `SHARED_STAT_DEFAULTS`); the builder lets a player nudge within
// [40, 90].
export const BRAVE_FAITH_MIN = 40;
export const BRAVE_FAITH_MAX = 90;

// Crit baseline shared by every v1 unit (ADR-0032). Not class-
// differentiated and not yet player-editable in the team builder, so it
// lives here as a constant rather than on the slider surface.
const CRIT_DEFAULTS = { crit_chance: 5, crit_multiplier: 1.5 } as const;

// Session 49: baseline level. Slot 0 = L25; outward slots step ±1 per
// position via `slotLevelFor`. Level modifies HP/MP by ±10% per ±1 and
// the class's dominant stat (per `classDominantStats`) by ±1 at ±2.
export const BASELINE_LEVEL = 25;

// Session 49: slot-to-level mapping. Slot 0 = L25; slot 1 = L24; slot 2
// = L26; slot 3 = L23; slot 4 = L27. Alternating outward from baseline:
// odd indices step *down* (slot 1 → -1, slot 3 → -2); even non-zero
// indices step *up* (slot 2 → +1, slot 4 → +2).
//
// Pattern extends naturally to larger teams: slot 5 → L22, slot 6 →
// L28, etc. MAX_TEAM_SIZE today is 5 so the only consumers are slots
// 0..4, but the formula stays sound for any future expansion.
export function slotLevelFor(slotIndex: number): number {
  if (slotIndex <= 0) return BASELINE_LEVEL;
  const halfStep = Math.floor((slotIndex + 1) / 2);
  return slotIndex % 2 === 0
    ? BASELINE_LEVEL + halfStep // even ≥ 2: +N
    : BASELINE_LEVEL - halfStep; // odd: -N
}

// Assemble a full `BaseStats` for a class at a given level: the five
// level-driven base stats from the M2 per-class curve (`leveledClassStats`,
// single source of truth for the curve math + §5 anchors) plus the
// player-chosen Brave / Faith and the uniform crit defaults. Mirrors
// `demo.ts`'s `baseStatsFor`, but takes Brave / Faith / level as arguments
// since the team builder makes Brave / Faith per-unit editable and level is
// slot-derived (Mage War) or progression-derived (campaign).
//
// The curve (ADR-0137, `docs/TABADesign/m2-stat-curves-brief.md`) is
// anchored so **L25 reproduces the §5 stat block exactly** — Mage War's
// L25 Knight is byte-identical; its off-L25 mages (L23/24/26/27) re-tune to
// the curve, a blessed change from the S49/S50 ±10% modifier this replaces.
//
// Level defaults to 25 (the anchor) so legacy callers that haven't adopted
// Level yet keep the exact §5 values.
//
// FORWARD SEAM — per-unit stat override (do NOT wire here; ADR-0137 §seam).
// TABA will later give unique characters (protagonists, guests) per-character
// stat overrides layered on top of this class-derived base — e.g. a flat
// MaxMP modifier keyed by the unit's stable id. That layer is a *future
// additive slice*, and it must arrive as **another `modifyStatQuery`
// handler**, NOT by re-baking values into this stored block. The insertion
// point: a per-character source registered at the engine `class` hook tier
// (conceptually alongside the class layer — the tier already exists in the
// collector's ordering, currently dormant), reading `{ flat, mult }` per
// stat keyed by unit id. Effective stat reads already compose through
// `modifyStatQuery` (Equipment → Class → Passive → Statuses); the override
// is just one more handler in that chain. This function stays the class
// *seed*; nothing here needs to change when the override lands.
export function buildBaseStats(
  classId: ClassId,
  brave: number,
  faith: number,
  level: number = BASELINE_LEVEL,
): BaseStats {
  const leveled = leveledClassStats(classId, level);
  return { ...leveled, brave, faith, ...CRIT_DEFAULTS };
}
