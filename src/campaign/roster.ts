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

import { buildBaseStats, gravityWell, mageWar, theIrregulars } from '@content/teams/index.ts';
import type { BuiltUnit } from '@content/teams/index.ts';
import { abilityId, bucketId, classId, commandSetId, itemId, unitId } from '@engine/index.ts';
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

// ---- M1 roster (Chris-picked, S78) ----
//
// M1's playthrough roster is hand-picked from the existing class lineup (the
// taba-m1-brief test-roster note) rather than the M0 slice default. Its base:
// the five members of the Mage War **Gravity Well** template — Sera (Assassin),
// Thessaly (Calculator), Lumen (Pyromancer), Chris (Templar), Clio
// (Hydrologist) — plus hand-authored additions.
//
// Every unit is normalized to the uniform campaign baseline (`M0_BASELINE_LEVEL`
// — the single knob for initial-testing difficulty; NOT the source templates'
// authored per-slot levels). `campaignUnitFromBuilt` carries the inputs
// (class/loadout/equipment/gender); the campaign recomputes baseStats at fold
// time (D-A).
//
// Equipment uniqueness is authored, not enforced here — the campaign bypasses
// the Mage War team builder (which runs `computeTeamValidity`), so the
// unique-per-team convention is upheld by hand. The roster below carries no
// item twice, so any K-of-N deployment is unique-per-team by construction.
// (When the economy owns equipment availability, this stays a non-issue —
// there was never a runtime rule to remove.)

// Alice — a hand-authored Alchemist skirmisher (not drawn from a template).
// Riptide Bow (two-handed) + Thievery secondary; Vantage/Eagle Eye support for
// a ranged opportunist.
const aliceAlchemist: BuiltUnit = {
  name: 'Alice',
  classId: classId('alchemist'),
  baseStats: buildBaseStats(classId('alchemist'), M0_DEFAULT_BRAVE, M0_DEFAULT_FAITH, M0_BASELINE_LEVEL),
  level: M0_BASELINE_LEVEL,
  gender: 'female',
  loadout: {
    actionBuckets: {
      [bucketId('first_action')]: [commandSetId('alchemy')],
      [bucketId('secondary_command_sets')]: [commandSetId('thief_arts')],
    },
    passiveBuckets: {
      [bucketId('reaction')]: [abilityId('damage_split'), abilityId('counter')],
      [bucketId('support')]: [abilityId('vantage'), abilityId('eagle_eye')],
      [bucketId('movement')]: [abilityId('bravestrider'), abilityId('thoughtful_pacing')],
    },
  },
  equipment: {
    // Riptide Bow is two-handed → one hand slot, off-hand left empty (null).
    leftHand: null,
    rightHand: itemId('riptide_bow'),
    headgear: itemId('skullclamp'),
    armor: itemId('soul_vest'),
    accessory: itemId('the_offering'),
  },
};

// Miluda — a hand-authored Knight (sword-and-board frontline). No secondary
// command set (Battle Skill only). NOTE: her kit reuses Warrior's Aegis /
// Tactical Mask / Soldier's Leathers / Gauntlet of Might, which the Gravity
// Well Templar ("Chris") also carries — a unique-per-team overlap (not enforced
// in campaign mode; authored deliberately).
const miludaKnight: BuiltUnit = {
  name: 'Miluda',
  classId: classId('knight'),
  baseStats: buildBaseStats(classId('knight'), M0_DEFAULT_BRAVE, M0_DEFAULT_FAITH, M0_BASELINE_LEVEL),
  level: M0_BASELINE_LEVEL,
  gender: 'female',
  loadout: {
    actionBuckets: {
      [bucketId('first_action')]: [commandSetId('battle_skill')],
      [bucketId('secondary_command_sets')]: [],
    },
    passiveBuckets: {
      [bucketId('reaction')]: [
        abilityId('counterpunch'),
        abilityId('combat_focus'),
        abilityId('speed_save'),
      ],
      // Display names: Travel Preparations = field_kit; Biomastery = earth_communion.
      [bucketId('support')]: [
        abilityId('field_kit'),
        abilityId('momentum'),
        abilityId('earth_communion'),
      ],
      // Healthy Stride = field_recovery.
      [bucketId('movement')]: [
        abilityId('field_recovery'),
        abilityId('thoughtful_pacing'),
        abilityId('fleet_of_foot'),
      ],
    },
  },
  equipment: {
    // Flametongue is one-handed → paired with the Warrior's Aegis off-hand.
    leftHand: itemId('warriors_aegis'),
    rightHand: itemId('flametongue'),
    headgear: itemId('tactical_mask'),
    armor: itemId('soldiers_leathers'),
    accessory: itemId('gauntlet_of_might'),
  },
};

// Can'tano — a hand-authored Terraformer (control caster). No secondary command
// set (Worldcraft only). NOTE: reuses Tome of Power (Thessaly), Skullclamp
// (Alice), and Wizard Robe (Lumen) — unique-per-team overlaps (not enforced).
const cantanoTerraformer: BuiltUnit = {
  name: "Can'tano",
  classId: classId('terraformer'),
  baseStats: buildBaseStats(classId('terraformer'), M0_DEFAULT_BRAVE, M0_DEFAULT_FAITH, M0_BASELINE_LEVEL),
  level: M0_BASELINE_LEVEL,
  gender: 'male',
  loadout: {
    actionBuckets: {
      [bucketId('first_action')]: [commandSetId('worldcraft')],
      [bucketId('secondary_command_sets')]: [],
    },
    passiveBuckets: {
      [bucketId('reaction')]: [abilityId('cornered_focus'), abilityId('discharge')],
      [bucketId('support')]: [abilityId('conductor'), abilityId('mathematician')],
      [bucketId('movement')]: [abilityId('move_plus_2'), abilityId('thoughtful_pacing')],
    },
  },
  equipment: {
    // Staff of Abundance (one-handed) + Tome of Power off-hand book.
    leftHand: itemId('staff_of_abundance'),
    rightHand: itemId('tome_of_power'),
    headgear: itemId('skullclamp'),
    armor: itemId('wizards_robe'),
    accessory: itemId('augmentor'),
  },
};

function buildM1Roster(): ReadonlyArray<CampaignUnit> {
  const source: ReadonlyArray<BuiltUnit> = [
    ...gravityWell.units,
    aliceAlchemist,
    miludaKnight,
    cantanoTerraformer,
  ];
  return source.map((built, i) => {
    const slug = built.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const id = `taba-m1-${String(i).padStart(2, '0')}-${slug}`;
    // Uniform baseline level (default) — override intentionally NOT passed.
    return campaignUnitFromBuilt(built, id);
  });
}

export const m1Roster: ReadonlyArray<CampaignUnit> = buildM1Roster();
