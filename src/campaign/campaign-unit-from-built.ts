// TABA campaign — convert a catalog-valid `BuiltUnit` into a durable
// `CampaignUnit`. Extracted from `roster.ts` so both the roster authoring and
// the plot-unit definitions can build units without an import cycle
// (roster ⇄ plot-units).

import { buildBaseStats } from '@content/teams/index.ts';
import type { BuiltUnit } from '@content/teams/index.ts';
import { unitId } from '@engine/index.ts';
import type { Vitals } from '@engine/index.ts';
import type { CampaignUnit } from './types.ts';
import { EMPTY_EARNED_BY_CLASS } from './types.ts';

// Uniform durable baseline level for authored units — the single knob for
// initial-testing difficulty (NOT the source templates' per-slot levels).
export const M0_BASELINE_LEVEL = 25;

// Default Brave/Faith for authored units (matches the team templates' 70/70).
export const M0_DEFAULT_BRAVE = 70;
export const M0_DEFAULT_FAITH = 70;

export interface CampaignUnitOverrides {
  readonly level?: number;
  readonly brave?: number;
  readonly faith?: number;
}

// Provisional full vitals from the *base* maxes (HP/MP before equipment). A
// catalog-free starting value; true effective-full normalization happens at
// campaign start / apply-back (which read equipment-adjusted maxes).
function provisionalFullVitals(
  classId: BuiltUnit['classId'],
  brave: number,
  faith: number,
  level: number,
): Vitals {
  const stats = buildBaseStats(classId, brave, faith, level);
  return { hp: stats.maxHpBase, mp: stats.maxMpBase };
}

// Convert a catalog-valid `BuiltUnit` into a durable `CampaignUnit`, minting the
// stable id ONCE here (D-B). Pulls the stored *inputs* (classId, loadout,
// equipment, gender, name) and assigns durable level/brave/faith — deliberately
// NOT the source unit's `baseStats`, which the campaign recomputes at fold time.
export function campaignUnitFromBuilt(
  built: BuiltUnit,
  id: string,
  overrides: CampaignUnitOverrides = {},
): CampaignUnit {
  const level = overrides.level ?? M0_BASELINE_LEVEL;
  const brave = overrides.brave ?? M0_DEFAULT_BRAVE;
  const faith = overrides.faith ?? M0_DEFAULT_FAITH;

  const unit: CampaignUnit = {
    id: unitId(id),
    name: built.name,
    classId: built.classId,
    level,
    brave,
    faith,
    loadout: built.loadout,
    equipment: built.equipment,
    vitals: provisionalFullVitals(built.classId, brave, faith, level),
    // M2 progression: fresh units carry no XP, no JP, and no unlocks. Authored
    // pre-unlocks (plot-uniques) would set these here; M0/M1 authors none.
    xp: 0,
    earnedByClass: EMPTY_EARNED_BY_CLASS,
    unlocks: [],
    fate: 'active',
  };

  // exactOptionalPropertyTypes: attach `gender` only when the source has it.
  return built.gender !== undefined ? { ...unit, gender: built.gender } : unit;
}
