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
  Loadout,
  UnitEquipment,
} from '@engine/index.ts';
import {
  classBaselineStats,
  classDominantStats,
  type ClassBaselineStats,
} from '../classes/baseline-stats.ts';

export interface BuiltUnit {
  readonly name: string;
  readonly classId: ClassId;
  readonly baseStats: BaseStats;
  readonly loadout: Loadout;
  readonly equipment: UnitEquipment;
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

// Assemble a full `BaseStats` for a class: the class-differentiated
// baseline (single source of truth in `baseline-stats.ts`) plus the
// player-chosen Brave / Faith, the uniform crit defaults, and the
// Session 49 Level modifier. Mirrors `demo.ts`'s `baseStatsFor`, but
// takes Brave / Faith / level as arguments since the team builder
// makes Brave / Faith per-unit editable and level is slot-derived.
//
// Level modifier (per Session 49 / ADR-0087, S50 retune):
//   - HP_modified = round(maxHpBase × (1 + 0.1 × sign(level − 25)))
//   - MP_modified = round(maxMpBase × (1 + 0.1 × sign(level − 25)))
//   - dominant_stat += 1 if level >= 27, -1 if level <= 23, else 0
//
// S50 capped the HP/MP shift at ±10% regardless of slot distance from
// baseline. Pre-S50 the multiplier was linear (`1 + 0.1 × (level − 25)`),
// so slot 3 / slot 4 (L23 / L27) lifted to ±20% HP/MP — heavier than
// Chris's design intent. The dominant-stat shift still ratchets at the
// ±2 boundary (so slot 3 vs slot 1 still differ on the dominant axis),
// preserving the slot-distance signal where it matters most.
//
// Rounding is `Math.round` (banker's-style nearest, half-up); the v1
// numbers all round cleanly. Floor-only would systematically bias the
// negative-modifier side; round is symmetric and matches FFT's tradition.
//
// Level defaults to 25 (no-op modifier) so legacy callers that haven't
// adopted Level yet keep their existing behavior.
export function buildBaseStats(
  classId: ClassId,
  brave: number,
  faith: number,
  level: number = BASELINE_LEVEL,
): BaseStats {
  const baseline = classBaselineStats.get(classId);
  if (baseline === undefined) {
    throw new Error(
      `buildBaseStats: no baseline stats registered for class ${String(classId)}`,
    );
  }
  const dominantStat = classDominantStats.get(classId);
  if (dominantStat === undefined) {
    throw new Error(
      `buildBaseStats: no dominant stat registered for class ${String(classId)}`,
    );
  }
  const levelOffset = level - BASELINE_LEVEL;
  // S50: cap HP/MP shift at ±10% — slot ±1 and slot ±2+ all land at the
  // same magnitude. Dominant stat still steps at ±2 (below).
  const hpMpMultiplier = 1 + 0.1 * Math.sign(levelOffset);
  const dominantStatDelta =
    levelOffset >= 2 ? 1 : levelOffset <= -2 ? -1 : 0;

  const leveled: ClassBaselineStats = {
    maxHpBase: Math.max(1, Math.round(baseline.maxHpBase * hpMpMultiplier)),
    maxMpBase: Math.max(0, Math.round(baseline.maxMpBase * hpMpMultiplier)),
    pa: baseline.pa + (dominantStat === 'pa' ? dominantStatDelta : 0),
    ma: baseline.ma + (dominantStat === 'ma' ? dominantStatDelta : 0),
    spd: baseline.spd + (dominantStat === 'spd' ? dominantStatDelta : 0),
  };
  return { ...leveled, brave, faith, ...CRIT_DEFAULTS };
}
