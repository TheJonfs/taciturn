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
// config-build time, so a unit's identity is its slot (0-3), not a
// stored key. Names are cosmetic; templates author them, the builder
// defaults them from the class.

import type {
  BaseStats,
  ClassId,
  Loadout,
  UnitEquipment,
} from '@engine/index.ts';
import { classBaselineStats } from '../classes/baseline-stats.ts';

export interface BuiltUnit {
  readonly name: string;
  readonly classId: ClassId;
  readonly baseStats: BaseStats;
  readonly loadout: Loadout;
  readonly equipment: UnitEquipment;
}

// Exactly four units — River Ridge / Mage War's locked team size. The
// tuple shape enforces the count at the type level so a malformed
// template fails to compile rather than at battle start.
export interface BuiltTeam {
  readonly name: string;
  readonly units: readonly [BuiltUnit, BuiltUnit, BuiltUnit, BuiltUnit];
}

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

// Assemble a full `BaseStats` for a class: the class-differentiated
// baseline (single source of truth in `baseline-stats.ts`) plus the
// player-chosen Brave / Faith and the uniform crit defaults. Mirrors
// `demo.ts`'s `baseStatsFor`, but takes Brave / Faith as arguments
// since the team builder makes them per-unit editable.
export function buildBaseStats(
  classId: ClassId,
  brave: number,
  faith: number,
): BaseStats {
  const baseline = classBaselineStats.get(classId);
  if (baseline === undefined) {
    throw new Error(
      `buildBaseStats: no baseline stats registered for class ${String(classId)}`,
    );
  }
  return { ...baseline, brave, faith, ...CRIT_DEFAULTS };
}
