// TABA campaign — M0 roster authoring.
//
// M0 has NO roster-authoring UI (taba-m0-brief). The roster is authored as
// data: a fixed handful of `CampaignUnit`s, enough to deploy K-of-N across
// two nodes. Rather than re-type loadouts/equipment by hand (and risk
// referencing ids the catalog doesn't have), we derive the roster from
// existing `BuiltTeam` templates via `campaignUnitFromBuilt` — they're
// already catalog-valid, so the units instantiate cleanly when Chunk 2
// folds them through `createInitialState`.
//
// The campaign bypasses Mage War's slot-derived level entirely (D-A): we
// author a uniform durable `level` per unit, overriding whatever level the
// source `BuiltUnit` carried.

import { buildBaseStats, mageWar, theIrregulars } from '@content/teams/index.ts';
import type { BuiltUnit } from '@content/teams/index.ts';
import { unitId } from '@engine/index.ts';
import type { Vitals } from '@engine/index.ts';
import type { CampaignUnit } from './types.ts';

// M0 roster size (N) and the per-node deploy cap (K) are parameters, not
// the hardcoded team-of-5 (watch-for in the brief). N is a roster
// property; K is authored per node (Chunk 3). Illustrative M0 values.
export const M0_ROSTER_SIZE = 8;

// Uniform durable baseline level for the M0 roster. A tuning value — picked
// so the reused enemy teams are winnable (Chunk 3 aligns the encounter).
export const M0_BASELINE_LEVEL = 25;

// Default Brave/Faith for authored units. Matches the team templates'
// convention (70/70); per-unit overrides are expressible but M0 authors
// flat.
const M0_DEFAULT_BRAVE = 70;
const M0_DEFAULT_FAITH = 70;

export interface CampaignUnitOverrides {
  readonly level?: number;
  readonly brave?: number;
  readonly faith?: number;
}

// Provisional full vitals from the *base* maxes (HP/MP before equipment
// contributions). This is a catalog-free starting value; the true
// effective-full normalization (which reads equipment-adjusted maxes via
// the engine) happens at campaign start / between-battle apply-back in
// Chunk 2. M0 heals to full each boundary, so the carried value is always
// "full" — see CampaignUnit.vitals (D-E).
function provisionalFullVitals(
  classId: BuiltUnit['classId'],
  brave: number,
  faith: number,
  level: number,
): Vitals {
  const stats = buildBaseStats(classId, brave, faith, level);
  return { hp: stats.maxHpBase, mp: stats.maxMpBase };
}

// Convert a catalog-valid `BuiltUnit` into a durable `CampaignUnit`,
// minting the stable id ONCE here (D-B). Pulls the stored *inputs*
// (classId, loadout, equipment, gender, name) and assigns durable
// level/brave/faith — deliberately NOT the source unit's `baseStats`,
// which the campaign recomputes at fold time (D-A).
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
    fate: 'active',
  };

  // exactOptionalPropertyTypes: attach `gender` only when the source has it.
  return built.gender !== undefined ? { ...unit, gender: built.gender } : unit;
}

// The authored M0 roster: N units drawn from two catalog-valid templates,
// each given a stable campaign id (`taba-m0-<NN>-<name>`) and the uniform
// baseline level. Mixed source classes; one-per-class is NOT enforced on
// the player side (the M4 relaxation is about authoring symmetry, not a
// roster constraint).
function buildM0Roster(): ReadonlyArray<CampaignUnit> {
  const source: ReadonlyArray<BuiltUnit> = [
    ...mageWar.units,
    ...theIrregulars.units,
  ].slice(0, M0_ROSTER_SIZE);

  if (source.length < M0_ROSTER_SIZE) {
    throw new Error(
      `buildM0Roster: source templates yielded only ${source.length} units, ` +
        `need ${M0_ROSTER_SIZE}`,
    );
  }

  return source.map((built, i) => {
    const slug = built.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const id = `taba-m0-${String(i).padStart(2, '0')}-${slug}`;
    return campaignUnitFromBuilt(built, id);
  });
}

export const m0Roster: ReadonlyArray<CampaignUnit> = buildM0Roster();
